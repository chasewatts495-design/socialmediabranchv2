/**
 * Shared between the edge middleware and Node server actions, so it only
 * uses Web Crypto. The cookie value is a keyed MAC of a fixed message —
 * possessing it proves the password was entered once.
 */
export const AUTH_COOKIE = "branch_auth";

export async function authToken(): Promise<string> {
  const password = process.env.APP_PASSWORD ?? "";
  const pepper = process.env.APP_ENCRYPTION_KEY ?? "branch-dev";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${password}|${pepper}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("branch-auth-v1"),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
