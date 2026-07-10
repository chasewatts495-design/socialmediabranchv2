/**
 * Signed OAuth state: proves the callback came from a flow this app
 * started, carries the brand + reauth context across the redirect, and
 * expires after 10 minutes. HMAC-SHA256 keyed off APP_ENCRYPTION_KEY
 * (Web Crypto only, same pattern as auth-token.ts).
 */

export interface OAuthState {
  provider: string;
  brandId: string | null;
  reauthAccountId?: string;
  nonce: string;
  ts: number;
}

const STATE_TTL_MS = 10 * 60_000;

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  // Copy into a plain ArrayBuffer-backed view (Web Crypto's BufferSource).
  return new Uint8Array(buf);
}

async function stateKey(): Promise<CryptoKey> {
  const secret = process.env.APP_ENCRYPTION_KEY ?? "branch-dev";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${secret}|oauth-state`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signState(
  state: Omit<OAuthState, "nonce" | "ts">,
): Promise<string> {
  const full: OAuthState = {
    ...state,
    nonce: crypto.randomUUID(),
    ts: Date.now(),
  };
  const body = b64url(new TextEncoder().encode(JSON.stringify(full)));
  const sig = await crypto.subtle.sign(
    "HMAC",
    await stateKey(),
    new TextEncoder().encode(body),
  );
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyState(raw: string): Promise<OAuthState | null> {
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await stateKey(),
    fromB64url(sig),
    new TextEncoder().encode(body),
  );
  if (!ok) return null;
  try {
    const state = JSON.parse(
      new TextDecoder().decode(fromB64url(body)),
    ) as OAuthState;
    if (typeof state.ts !== "number" || Date.now() - state.ts > STATE_TTL_MS) {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}
