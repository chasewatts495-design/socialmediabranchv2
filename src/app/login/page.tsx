import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_COOKIE, authToken } from "@/lib/auth-token";

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const expected = process.env.APP_PASSWORD;
  if (!expected) redirect("/");
  if (password !== expected) redirect("/login?error=1");

  const jar = await cookies();
  jar.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!process.env.APP_PASSWORD) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white">
            B
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Branch</h1>
          <p className="mt-1 text-sm text-muted">
            Your social media command center
          </p>
        </div>
        <form
          action={login}
          className="rounded-2xl border border-border bg-surface p-6 shadow-xl"
        >
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-muted"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoFocus
            required
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-ink outline-none placeholder:text-faint focus:border-accent"
            placeholder="Enter your password"
          />
          {error && (
            <p className="mt-3 text-sm text-danger">
              Wrong password — try again.
            </p>
          )}
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-accent px-4 py-3 font-medium text-white transition hover:bg-accent-strong"
          >
            Unlock
          </button>
        </form>
      </div>
    </main>
  );
}
