import { headers } from "next/headers";

/**
 * The exact redirect URI a platform must be configured with. Built from
 * the live request (honoring Vercel's forwarded headers) so the value the
 * wizard shows is byte-for-byte what the callback will present.
 * APP_BASE_URL overrides everything for pinned production URLs.
 */
export async function appBaseUrl(): Promise<string> {
  const pinned = process.env.APP_BASE_URL;
  if (pinned) return pinned.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function redirectUriFor(provider: string): Promise<string> {
  return `${await appBaseUrl()}/api/oauth/${provider}/callback`;
}
