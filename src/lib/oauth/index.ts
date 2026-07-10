import type { PlatformId } from "@/lib/connectors/types";
import type { OAuthProvider } from "./types";
import { pinterestProvider } from "./providers/pinterest";
import { googleProvider } from "./providers/google";
import { metaProvider } from "./providers/meta";

/** Every OAuth provider Branch can talk to (Reddit uses its sanctioned
 * script-app password grant instead of a redirect flow, so it isn't here). */
export const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  pinterest: pinterestProvider,
  google: googleProvider,
  meta: metaProvider,
};

/** Which provider (developer app) a platform connects through. */
export const PROVIDER_FOR_PLATFORM: Partial<Record<PlatformId, string>> = {
  pinterest: "pinterest",
  youtube: "google",
  instagram: "meta",
  facebook: "meta",
};

export function providerFor(key: string): OAuthProvider | null {
  return OAUTH_PROVIDERS[key] ?? null;
}
