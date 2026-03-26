/**
 * Typed fetch wrapper that returns parsed JSON with proper TypeScript types.
 * Throws on non-ok responses with the server's error message.
 */
export async function fetchJSON<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch that returns the raw Response for cases where we need to check
 * status codes before parsing (e.g., 402, 409, 425).
 */
export async function fetchRaw(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}
