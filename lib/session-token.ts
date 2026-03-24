/**
 * HMAC-based session tokens for CF Workers.
 *
 * After SIWE signature verification, we issue a signed token containing
 * the verified wallet address and expiry. This token is:
 *   - Stateless: no server-side store needed, works across isolates
 *   - Tamper-proof: HMAC-SHA256 signed with SESSION_SECRET
 *   - Time-limited: 24h TTL
 *   - Self-contained: address is embedded, not trusted from client body
 *
 * Token format: base64({ address, iat, exp }) + "." + base64(hmac)
 */

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return secret;
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

export interface SessionPayload {
  address: string;
  iat: number;
  exp: number;
}

/** Create a signed session token after successful SIWE verification. */
export async function createSessionToken(address: string): Promise<string> {
  const secret = getSecret();
  const now = Date.now();
  const payload: SessionPayload = {
    address: address.toLowerCase(),
    iat: now,
    exp: now + SESSION_TTL,
  };
  const payloadStr = btoa(JSON.stringify(payload));
  const sig = await hmacSign(payloadStr, secret);
  return `${payloadStr}.${sig}`;
}

/**
 * Verify a session token and return the payload.
 * Returns null if invalid, tampered, or expired.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;

  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return null;

  const payloadStr = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  try {
    const secret = getSecret();
    const valid = await hmacVerify(payloadStr, sig, secret);
    if (!valid) return null;

    const payload: SessionPayload = JSON.parse(atob(payloadStr));

    // Check expiry
    if (!payload.exp || Date.now() > payload.exp) return null;

    // Validate address format
    if (!payload.address || !/^0x[a-f0-9]{40}$/.test(payload.address)) return null;

    return payload;
  } catch {
    return null;
  }
}
