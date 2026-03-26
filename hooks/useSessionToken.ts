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

export function useSessionToken() {
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authAttemptedRef = useRef(false);

  // On mount + address change: check localStorage for existing session
  useEffect(() => {
    if (!address) {
      setSessionToken(null);
      return;
    }

    const existing = loadSession(address);
    if (existing) {
      setSessionToken(existing);
      authAttemptedRef.current = true; // Don't re-prompt
    } else {
      authAttemptedRef.current = false; // Allow one auth attempt
    }
  }, [address]);

  // Redirect to landing if wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      // Clear session for the disconnected wallet
      if (address) clearSession(address);
      setSessionToken(null);

      const timer = setTimeout(() => {
        router.push("/");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, router]);

  // SIWE authentication — only runs if no cached session exists
  const authenticate = useCallback(async () => {
    if (!address || sessionToken || isAuthenticating || authAttemptedRef.current) return;
    authAttemptedRef.current = true; // Prevent double-prompt
    setIsAuthenticating(true);

    try {
      const nonceRes = await fetch("/api/session");
      const { message } = await nonceRes.json() as any;
      const signature = await signMessageAsync({ message });
      const verifyRes = await fetch("/api/session/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message }),
      });

      if (verifyRes.ok) {
        const { token } = await verifyRes.json() as any;
        setSessionToken(token);
        saveSession(address, token);
      }
    } catch {
      // User rejected sign or network error — don't retry automatically
      // They can refresh or reconnect to try again
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, sessionToken, isAuthenticating, signMessageAsync]);

  // Trigger auth only when:
  // - Wallet connected + address known
  // - No existing session (localStorage was empty)
  // - Haven't already attempted this mount
  useEffect(() => {
    if (isConnected && address && !sessionToken && !isAuthenticating && !authAttemptedRef.current) {
      authenticate();
    }
  }, [isConnected, address, sessionToken, isAuthenticating, authenticate]);

  return { sessionToken, isConnected, address, isAuthenticating };
}
