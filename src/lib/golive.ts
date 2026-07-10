import { and, eq, like } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { accounts, postTargets, settings } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";

/**
 * "Go live" checklist state, derived from what has actually happened —
 * never a stored to-do list that can drift from reality.
 */

export interface GoLiveStep {
  key: string;
  title: string;
  detail: string;
  href: string;
  done: boolean;
}

export interface GoLiveState {
  steps: GoLiveStep[];
  doneCount: number;
  dismissed: boolean;
}

export async function getGoLiveState(): Promise<GoLiveState> {
  const db = await getDb();

  const [
    dismissedRaw,
    anthropicKey,
    oauthAppRows,
    liveAccount,
    livePublished,
    recyclingOn,
  ] = await Promise.all([
    getSetting("golive.dismissed"),
    getSetting("anthropic.apiKey"),
    db
      .select({ key: settings.key })
      .from(settings)
      .where(like(settings.key, "oauthApp.%"))
      .limit(1),
    db.query.accounts.findFirst({ where: (a, { eq: e }) => e(a.mode, "live") }),
    db
      .select({ id: postTargets.id })
      .from(postTargets)
      .innerJoin(accounts, eq(postTargets.accountId, accounts.id))
      .where(
        and(eq(postTargets.status, "published"), eq(accounts.mode, "live")),
      )
      .limit(1),
    db.query.recycleRules.findFirst({
      where: (r, { eq: e }) => e(r.enabled, true),
    }),
  ]);

  const deployed =
    Boolean(process.env.APP_BASE_URL) || process.env.VERCEL === "1";
  const hasCredentialedAccount = await db.query.credentials.findFirst({});

  const steps: GoLiveStep[] = [
    {
      key: "deploy",
      title: "Put Branch on the internet",
      detail:
        "Deploy to Vercel + Neon (free, ~15 min) so it works from your phone — DEPLOY.md walks through every click.",
      href: "/settings",
      done: deployed,
    },
    {
      key: "app-keys",
      title: "Create your first developer app",
      detail:
        "Reddit is the 2-minute one — the wizard shows the exact clicks and keeps the keys encrypted.",
      href: "/connections/reddit",
      done: oauthAppRows.length > 0 || Boolean(hasCredentialedAccount),
    },
    {
      key: "live-account",
      title: "Connect a real account",
      detail: "Log in on the platform's own page; Branch goes LIVE for it.",
      href: "/connections",
      done: Boolean(liveAccount),
    },
    {
      key: "first-post",
      title: "Publish your first real post",
      detail: "Compose once — Branch fans it out and records the live URL.",
      href: "/composer",
      done: livePublished.length > 0,
    },
    {
      key: "recycling",
      title: "Turn on content recycling",
      detail: "Your best posts re-run themselves on a cadence you set.",
      href: "/calendar?tab=recycle",
      done: Boolean(recyclingOn),
    },
    {
      key: "ai",
      title: "Plug in the AI strategist",
      detail:
        "Add your Anthropic key so reports, briefs, and the caption writer run on Claude.",
      href: "/settings",
      done: Boolean(anthropicKey),
    },
  ];

  return {
    steps,
    doneCount: steps.filter((s) => s.done).length,
    dismissed: dismissedRaw === "true",
  };
}
