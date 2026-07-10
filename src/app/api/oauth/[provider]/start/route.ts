import { NextRequest, NextResponse } from "next/server";
import { providerFor } from "@/lib/oauth";
import { getOAuthAppCreds } from "@/lib/oauth/app-credentials";
import { redirectUriFor, appBaseUrl } from "@/lib/oauth/redirect-uri";
import { signState } from "@/lib/oauth/state";
import { codeChallengeS256, makeCodeVerifier } from "@/lib/oauth/pkce";
import { ALL_BRANDS, getActiveBrandId } from "@/lib/brands";

export const dynamic = "force-dynamic";

/**
 * Kicks off the platform-login window: the owner authenticates on the
 * platform's own page; Branch never sees that password.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: key } = await params;
  const provider = providerFor(key);
  const base = await appBaseUrl();
  if (!provider) {
    return NextResponse.redirect(`${base}/connections?oauth_error=unknown-provider`);
  }

  const found = await getOAuthAppCreds(key);
  if (!found) {
    // Wizard shows the friendly "paste your app keys first" state.
    const back = provider.platformIds[0];
    return NextResponse.redirect(
      `${base}/connections/${back}?oauth_error=missing-app`,
    );
  }

  const activeBrand = await getActiveBrandId();
  const state = await signState({
    provider: key,
    brandId: activeBrand === ALL_BRANDS ? null : activeBrand,
    reauthAccountId: req.nextUrl.searchParams.get("reauth") ?? undefined,
  });

  let codeChallenge: string | undefined;
  const res = { cookie: null as string | null };
  if (provider.usesPkce) {
    const verifier = makeCodeVerifier();
    codeChallenge = await codeChallengeS256(verifier);
    res.cookie = verifier;
  }

  const url = provider.authorizeUrl({
    creds: found.creds,
    redirectUri: await redirectUriFor(key),
    state,
    codeChallenge,
  });

  const redirect = NextResponse.redirect(url);
  if (res.cookie) {
    redirect.cookies.set(`oauth_pkce_${key}`, res.cookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/api/oauth",
    });
  }
  return redirect;
}
