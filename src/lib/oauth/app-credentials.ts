import { getSetting, setSetting, deleteSetting } from "@/lib/settings";
import type { OAuthAppCreds } from "./types";

/**
 * Developer-app credentials (Client ID + Secret), pasted once per platform
 * in the wizard. Stored AES-256-GCM encrypted in settings under
 * `oauthApp.<provider>`; environment variables work as a fallback so a
 * deployment can also configure them without touching the UI.
 */

const ENV_KEYS: Record<string, [string, string]> = {
  pinterest: ["PINTEREST_CLIENT_ID", "PINTEREST_CLIENT_SECRET"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  meta: ["META_APP_ID", "META_APP_SECRET"],
};

export async function getOAuthAppCreds(
  provider: string,
): Promise<{ creds: OAuthAppCreds; source: "settings" | "env" } | null> {
  const raw = await getSetting(`oauthApp.${provider}`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as OAuthAppCreds;
      if (parsed.clientId && parsed.clientSecret) {
        return { creds: parsed, source: "settings" };
      }
    } catch {
      // fall through to env
    }
  }
  const envPair = ENV_KEYS[provider];
  if (envPair) {
    const clientId = process.env[envPair[0]];
    const clientSecret = process.env[envPair[1]];
    if (clientId && clientSecret) {
      return { creds: { clientId, clientSecret }, source: "env" };
    }
  }
  return null;
}

export async function saveOAuthAppCreds(
  provider: string,
  creds: OAuthAppCreds,
): Promise<void> {
  await setSetting(`oauthApp.${provider}`, JSON.stringify(creds), {
    encrypted: true,
  });
}

export async function deleteOAuthAppCreds(provider: string): Promise<void> {
  await deleteSetting(`oauthApp.${provider}`);
}
