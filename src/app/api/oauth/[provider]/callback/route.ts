import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { providerFor } from "@/lib/oauth";
import { getOAuthAppCreds } from "@/lib/oauth/app-credentials";
import { linkDiscoveredAccount } from "@/lib/oauth/link-account";
import { appBaseUrl, redirectUriFor } from "@/lib/oauth/redirect-uri";
import { verifyState } from "@/lib/oauth/state";
import { setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * The platform sends the owner's browser back here after they log in on
 * the platform's own page. Exchanges the one-time code for tokens, finds
 * the account(s) behind them, and links them into Branch.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: key } = await params;
  const base = await appBaseUrl();
  const provider = providerFor(key);
  if (!provider) {
    return NextResponse.redirect(`${base}/connections?oauth_error=unknown-provider`);
  }
  const wizardPath = `/connections/${provider.platformIds[0]}`;

  const search = req.nextUrl.searchParams;
  if (search.get("error")) {
    // The owner hit "cancel" on the platform's consent screen.
    return NextResponse.redirect(
      `${base}${wizardPath}?oauth_error=${encodeURIComponent(search.get("error")!)}`,
    );
  }

  const code = search.get("code");
  const state = await verifyState(search.get("state") ?? "");
  if (!code || !state || state.provider !== key) {
    return NextResponse.redirect(`${base}${wizardPath}?oauth_error=bad-state`);
  }

  const found = await getOAuthAppCreds(key);
  if (!found) {
    return NextResponse.redirect(`${base}${wizardPath}?oauth_error=missing-app`);
  }

  try {
    const codeVerifier = provider.usesPkce
      ? req.cookies.get(`oauth_pkce_${key}`)?.value
      : undefined;
    const tokenSet = await provider.exchangeCode({
      code,
      redirectUri: await redirectUriFor(key),
      creds: found.creds,
      codeVerifier,
    });
    const discovered = await provider.discoverAccounts(tokenSet, found.creds);
    const db = await getDb();

    if (discovered.length === 1) {
      const accountId = await linkDiscoveredAccount(db, discovered[0], {
        brandId: state.brandId,
        reauthAccountId: state.reauthAccountId,
      });
      return NextResponse.redirect(
        `${base}/connections/${discovered[0].platformId}?connected=${accountId}`,
      );
    }

    // Several accounts behind one login (Meta Pages + IG profiles):
    // stash them encrypted and let the owner pick.
    await setSetting(
      `oauth.pending.${state.nonce}`,
      JSON.stringify({
        provider: key,
        brandId: state.brandId,
        createdAt: Date.now(),
        accounts: discovered,
      }),
      { encrypted: true },
    );
    return NextResponse.redirect(
      `${base}/connections/select?nonce=${state.nonce}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "connection failed";
    return NextResponse.redirect(
      `${base}${wizardPath}?oauth_error=${encodeURIComponent(message.slice(0, 180))}`,
    );
  }
}
