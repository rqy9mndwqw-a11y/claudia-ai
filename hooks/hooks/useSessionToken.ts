"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";

/**
 * Shared SIWE session authentication hook with localStorage persistence.
 *
 * Auth flow (user perspective):
 * 1. Connect wallet (RainbowKit — one click)
 * 2. Sign SIWE message (one MetaMask prompt — once per 24hrs)
 * 3. Navigate freely — no more prompts until session expires
 *
 * Persistence:
 * - Token stored in localStorage keyed by wallet address
 * - Survives page navigation, refresh, and tab close
 * - Auto-expires after 24 hours (matches server-side TTL)
 * - Cleared on wallet disconnect
 *
 * States:
 * - "checking"      — reading localStorage, brief spinner
 * - "authenticated" — session found/created, ready to use
 * - "needs_auth"    — no session, will prompt SIWE
 * - "error"         — network/signing error, show retry
 */

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

interface StoredSession {
  token: string;
  expiry: number;
}

function getStorageKey(address: string): string {
  return `claudia_session_${address.toLowerCase()}`;
}

function loadSession(address: string): string | null {
  try {
    const raw = localStorage.getItem(getStorageKey(address));
    if (!raw) return null;

    const session: StoredSession = JSON.parse(raw);

    // Check expiry
    if (Date.now() > session.expiry) {
      localStorage.removeItem(getStorageKey(address));
      return null;
    }

    return session.token;
  } catch {
    return null;
  }
}

function saveSession(address: string, token: string): void {
  try {
    const session: StoredSession = {
      token,
      expiry: Date.now() + SESSION_TTL,
    };
    localStorage.setItem(getStorageKey(address), JSON.stringify(session));
  } catch {}
}

function clearSession(address: string): void {
  try {
    localStorage.removeItem(getStorageKey(address));
  } catch {}
}

type SessionState = "checking" | "authenticated" | "needs_auth" | "error";

/**
 * Try to load session from localStorage for any recent address.
 * Scans localStorage keys to find a valid session even before wagmi provides the address.
 */
function loadAnySession(): { token: string; address: string } | null {
  try {
    let best: { token: string; address: string; expiry: number } | null = null;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("claudia_session_")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const session: StoredSession = JSON.parse(raw);
      if (Date.now() > session.expiry) {
        localStorage.removeItem(key);
        continue;
      }
      const addr = key.replace("claudia_session_", "");
      // Pick the session with the latest expiry (most recently created)
      if (!best || session.expiry > best.expiry) {
        best = { token: session.token, address: addr, expiry: session.expiry };
      }
    }

    return best ? { token: best.token, address: best.address } : null;
  } catch {}
  return null;
}

export function useSessionToken() {
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();

  // Initialize synchronously from localStorage — survives remounts
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const cached = loadAnySession();
    return cached?.token ?? null;
  });
  const [sessionState, setSessionState] = useState<SessionState>(() => {
    if (typeof window === "undefined") return "checking";
    return loadAnySession() ? "authenticated" : "checking";
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [promoCredits, setPromoCredits] = useState(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authAttemptedRef = useRef(false);
  const mountedRef = useRef(true);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // When address becomes available: verify the cached session matches, or load fresh
  useEffect(() => {
    if (!address) {
      // Don't clear session here — wagmi may just be reconnecting
      // Only clear if wallet is explicitly disconnected (handled below)
      return;
    }

    const existing = loadSession(address);
    if (existing) {
      setSessionToken(existing);
      setSessionState("authenticated");
      authAttemptedRef.current = true;
    } else if (sessionState !== "authenticated") {
      // Only go to needs_auth if we don't already have a valid session
      setSessionState("needs_auth");
      authAttemptedRef.current = false;
    }
  }, [address]);

  // Clear session on explicit disconnect only — not during wagmi reconnection.
  // wagmi briefly returns isConnected=false with a stale address during page navigation.
  // Only clear if the user explicitly disconnected (address goes from defined to undefined).
  const prevAddressRef = useRef(address);
  useEffect(() => {
    // Wallet was connected (had address) and is now fully disconnected (no address)
    if (prevAddressRef.current && !address && !isConnected) {
      clearSession(prevAddressRef.current);
      setSessionToken(null);
      setSessionState("checking");
      router.push("/");
    }
    prevAddressRef.current = address;
  }, [isConnected, address]);

  // SIWE authentication
  const authenticate = useCallback(async () => {
    if (!address || isAuthenticating) return;
    authAttemptedRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);
    setSessionState("checking");

    try {
      const nonceRes = await fetch("/api/session");
      if (!nonceRes.ok) throw new Error("Failed to get nonce. Check your connection.");

      const { message } = await nonceRes.json() as any;
      const signature = await signMessageAsync({ message });
      const verifyRes = await fetch("/api/session/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => null) as any;
        throw new Error(data?.error || "Signature verification failed");
      }

      const verifyData = await verifyRes.json() as any;
      if (mountedRef.current) {
        setSessionToken(verifyData.token);
        saveSession(address, verifyData.token);
        setSessionState("authenticated");
        if (verifyData.promoCredits) {
          setPromoCredits(verifyData.promoCredits);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        const msg = (err as Error).message;
        if (msg.includes("rejected") || msg.includes("denied")) {
          setAuthError("Signature rejected. Click retry to try again.");
        } else {
          setAuthError(msg);
        }
        setSessionState("error");
      }
    } finally {
      if (mountedRef.current) {
        setIsAuthenticating(false);
      }
    }
  }, [address, isAuthenticating, signMessageAsync]);

  // Auto-trigger auth when needed (only once per mount/address change)
  useEffect(() => {
    if (isConnected && address && sessionState === "needs_auth" && !authAttemptedRef.current) {
      authenticate();
    }
  }, [isConnected, address, sessionState, authenticate]);

  // Retry function for error state
  const retry = useCallback(() => {
    authAttemptedRef.current = false;
    setAuthError(null);
    setSessionState("needs_auth");
  }, []);

  const dismissPromo = useCallback(() => setPromoCredits(0), []);

  return {
    sessionToken,
    isConnected,
    address,
    isAuthenticating,
    sessionState,
    authError,
    retry,
    promoCredits,
    dismissPromo,
  };
}
