/** PKCE (RFC 7636) S256 helpers — Web Crypto only. */

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function makeCodeVerifier(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return b64url(bytes); // 64 chars, within the 43–128 spec range
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return b64url(new Uint8Array(digest));
}
