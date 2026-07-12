import { afterEach, describe, expect, it, vi } from "vitest";
import { signState, verifyState } from "@/lib/oauth/state";
import { codeChallengeS256, makeCodeVerifier } from "@/lib/oauth/pkce";
import { pinterestProvider } from "@/lib/oauth/providers/pinterest";
import { googleProvider } from "@/lib/oauth/providers/google";
import { metaProvider } from "@/lib/oauth/providers/meta";

const CREDS = { clientId: "client-123", clientSecret: "secret-456" };
const REDIRECT = "https://branch.example/api/oauth/pinterest/callback";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchJson(payloads: unknown[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const body = payloads[Math.min(i++, payloads.length - 1)];
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  return calls;
}

describe("OAuth state", () => {
  it("round-trips and preserves the payload", async () => {
    const raw = await signState({ provider: "pinterest", brandId: "b1" });
    const state = await verifyState(raw);
    expect(state?.provider).toBe("pinterest");
    expect(state?.brandId).toBe("b1");
    expect(state?.nonce).toBeTruthy();
  });

  it("rejects tampered payloads", async () => {
    const raw = await signState({ provider: "pinterest", brandId: null });
    const [body, sig] = raw.split(".");
    const evil = Buffer.from(
      JSON.stringify({ provider: "meta", brandId: null, nonce: "x", ts: Date.now() }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifyState(`${evil}.${sig}`)).toBeNull();
    expect(await verifyState(`${body}.AAAA`)).toBeNull();
    expect(await verifyState("garbage")).toBeNull();
  });

  it("expires after its TTL", async () => {
    vi.useFakeTimers();
    const raw = await signState({ provider: "google", brandId: null });
    vi.advanceTimersByTime(11 * 60_000);
    expect(await verifyState(raw)).toBeNull();
    vi.useRealTimers();
  });
});

describe("PKCE", () => {
  it("produces a spec-compliant verifier and S256 challenge", async () => {
    const verifier = makeCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    // RFC 7636 appendix B test vector
    expect(
      await codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("providers", () => {
  it("pinterest: authorize URL carries client id, redirect, state, scopes", () => {
    const url = new URL(
      pinterestProvider.authorizeUrl({
        creds: CREDS,
        redirectUri: REDIRECT,
        state: "st4te",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://www.pinterest.com/oauth/");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("state")).toBe("st4te");
    expect(url.searchParams.get("scope")).toContain("pins:write");
  });

  it("pinterest: refresh rotates and keeps the new refresh token", async () => {
    const calls = mockFetchJson([
      {
        access_token: "new-at",
        refresh_token: "new-rt",
        expires_in: 3600,
        token_type: "bearer",
      },
    ]);
    const out = await pinterestProvider.refresh!(
      { accessToken: "old-at", refreshToken: "old-rt", scopes: [] },
      CREDS,
    );
    expect(out.accessToken).toBe("new-at");
    expect(out.refreshToken).toBe("new-rt"); // rotation persisted
    expect(out.expiresAt).toBeGreaterThan(Date.now());
    expect(calls[0].url).toContain("api.pinterest.com/v5/oauth/token");
    const auth = (calls[0].init?.headers as Record<string, string>).Authorization;
    expect(auth).toMatch(/^Basic /);
  });

  it("google: exchange posts the code and returns a token set", async () => {
    mockFetchJson([
      {
        access_token: "g-at",
        refresh_token: "g-rt",
        expires_in: 3599,
        scope: "https://www.googleapis.com/auth/youtube.readonly",
      },
    ]);
    const out = await googleProvider.exchangeCode({
      code: "the-code",
      redirectUri: REDIRECT,
      creds: CREDS,
    });
    expect(out.accessToken).toBe("g-at");
    expect(out.refreshToken).toBe("g-rt");
    expect(out.scopes).toContain(
      "https://www.googleapis.com/auth/youtube.readonly",
    );
  });

  it("google: refresh keeps the original refresh token (no rotation)", async () => {
    mockFetchJson([{ access_token: "g-at2", expires_in: 3600 }]);
    const out = await googleProvider.refresh!(
      { accessToken: "g-at", refreshToken: "g-rt", scopes: [] },
      CREDS,
    );
    expect(out.accessToken).toBe("g-at2");
    expect(out.refreshToken).toBe("g-rt");
  });

  it("meta: authorize URL uses the scope list without a config id", () => {
    const url = new URL(
      metaProvider.authorizeUrl({
        creds: CREDS,
        redirectUri: REDIRECT,
        state: "st4te",
      }),
    );
    expect(url.searchParams.get("scope")).toContain("instagram_content_publish");
    expect(url.searchParams.get("config_id")).toBeNull();
  });

  it("meta: authorize URL switches to config_id for Business-login apps", () => {
    const url = new URL(
      metaProvider.authorizeUrl({
        creds: { ...CREDS, configId: "1234567890" },
        redirectUri: REDIRECT,
        state: "st4te",
      }),
    );
    expect(url.searchParams.get("config_id")).toBe("1234567890");
    // A scope list alongside config_id is what triggers "Invalid Scopes".
    expect(url.searchParams.get("scope")).toBeNull();
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("state")).toBe("st4te");
  });

  it("meta: exchange upgrades to a long-lived token, discovery yields page + IG", async () => {
    mockFetchJson([
      { access_token: "short", expires_in: 5000 },
      { access_token: "long-lived", expires_in: 5_184_000 },
      {
        data: [
          {
            id: "page-1",
            name: "Aurora Page",
            access_token: "page-token-1",
            instagram_business_account: { id: "ig-9", username: "aurora.ig" },
          },
        ],
      },
    ]);
    const tokens = await metaProvider.exchangeCode({
      code: "c",
      redirectUri: REDIRECT,
      creds: CREDS,
    });
    expect(tokens.accessToken).toBe("long-lived");

    const found = await metaProvider.discoverAccounts(tokens, CREDS);
    expect(found).toHaveLength(2);
    const fb = found.find((f) => f.platformId === "facebook")!;
    const ig = found.find((f) => f.platformId === "instagram")!;
    expect(fb.credentialPayload.pageToken).toBe("page-token-1");
    expect(ig.credentialPayload.igUserId).toBe("ig-9");
    expect(ig.handle).toBe("@aurora.ig");
  });
});
