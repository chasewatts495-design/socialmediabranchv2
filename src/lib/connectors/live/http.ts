/**
 * The one HTTP seam every live connector calls through — unit tests mock
 * `liveFetch` and nothing else.
 */

export class LiveHttpError extends Error {
  constructor(
    public status: number,
    public bodyText: string,
    public url: string,
  ) {
    super(`HTTP ${status} from ${url}: ${bodyText.slice(0, 300)}`);
    this.name = "LiveHttpError";
  }
}

export interface LiveFetchInit {
  method?: "GET" | "POST" | "DELETE";
  headers?: Record<string, string>;
  /** Form-encoded body (exclusive with json). */
  form?: Record<string, string>;
  /** JSON body (exclusive with form). */
  json?: unknown;
}

export async function liveFetch<T>(
  url: string,
  init: LiveFetchInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...init.headers,
  };
  let body: string | undefined;
  if (init.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(init.form).toString();
  } else if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(url, {
    method: init.method ?? (body ? "POST" : "GET"),
    headers,
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new LiveHttpError(res.status, text, url);
  return (text ? JSON.parse(text) : {}) as T;
}
