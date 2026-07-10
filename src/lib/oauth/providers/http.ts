/** Tiny fetch helpers the providers share — one seam for tests to mock. */

export class OAuthHttpError extends Error {
  constructor(
    public status: number,
    public body: string,
    url: string,
  ) {
    // Query strings can carry client secrets/codes and this message can
    // surface in redirect params and UI — strip them.
    super(`OAuth HTTP ${status} from ${url.split("?")[0]}: ${body.slice(0, 300)}`);
    this.name = "OAuthHttpError";
  }
}

export async function postForm<T>(
  url: string,
  form: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      ...headers,
    },
    body: new URLSearchParams(form).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new OAuthHttpError(res.status, text, url);
  return JSON.parse(text) as T;
}

export async function getJson<T>(
  url: string,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
  });
  const text = await res.text();
  if (!res.ok) throw new OAuthHttpError(res.status, text, url);
  return JSON.parse(text) as T;
}

export function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export function expiresAtFrom(expiresInSec: number | undefined): number | undefined {
  return expiresInSec ? Date.now() + expiresInSec * 1000 : undefined;
}
