import type { MetricSummary, AccountSummary } from "@/lib/metrics/summary";
import type {
  AccountAudit,
  AdBrief,
  ContentPlan,
  PostIdeas,
  WeeklyReview,
} from "./contracts";
import type { PlatformId } from "@/lib/connectors/types";
import { PLATFORM_LABELS } from "@/lib/metrics/colors";

/**
 * Deterministic fallback strategist: fills the SAME output contracts as
 * Claude, from the real metric summary, using simple rules + the playbook
 * lever lists. Clearly labeled generatedBy: "demo" in the UI.
 */

const BEST_FORMAT_FALLBACK: Record<string, string> = {
  instagram: "reel",
  facebook: "native video",
  tiktok: "short video",
  x: "text + image",
  youtube: "short",
  reddit: "text discussion",
  pinterest: "idea pin",
  snapchat: "story",
};

function bestFormat(a: AccountSummary): string {
  const entries = Object.entries(a.formatMix).sort((x, y) => y[1] - x[1]);
  return entries[0]?.[0] ?? BEST_FORMAT_FALLBACK[a.platform] ?? "video";
}

function bestTimeBucket(a: AccountSummary): { label: string; timeLocal: string } {
  const entries = Object.entries(a.postingTimeHistogram).sort((x, y) => y[1] - x[1]);
  const bucket = entries[0]?.[0] ?? "evening";
  const times: Record<string, string> = {
    morning: "08:30",
    midday: "12:30",
    evening: "19:00",
    night: "22:00",
  };
  return { label: bucket, timeLocal: times[bucket] };
}

function grade(a: AccountSummary): "A" | "B" | "C" | "D" | "F" {
  const growth = a.followers.d30Pct ?? 0;
  const er = a.avgEngagementRate.d30 ?? 0;
  const erPrev = a.avgEngagementRate.prev30 ?? er;
  const erTrendUp = er >= erPrev;
  const score =
    (growth > 8 ? 2 : growth > 3 ? 1 : growth < 0 ? -1 : 0) +
    (er > 5 ? 2 : er > 2.5 ? 1 : er < 1.5 ? -1 : 0) +
    (erTrendUp ? 1 : -1) +
    (a.reach.trend === "up" ? 1 : a.reach.trend === "down" ? -1 : 0);
  if (score >= 5) return "A";
  if (score >= 3) return "B";
  if (score >= 1) return "C";
  if (score >= -1) return "D";
  return "F";
}

export function demoAccountAudit(summary: MetricSummary): AccountAudit {
  const perAccount = summary.accounts.map((a) => {
    const g = grade(a);
    const fmt = bestFormat(a);
    const time = bestTimeBucket(a);
    const working: string[] = [];
    const notWorking: string[] = [];

    if ((a.followers.d30Pct ?? 0) > 3)
      working.push(
        `Follower growth of ${a.followers.d30Pct}% in 30 days (${a.followers.d30Delta?.toLocaleString()} net new)`,
      );
    if ((a.avgEngagementRate.d30 ?? 0) > (a.avgEngagementRate.prev30 ?? 0))
      working.push(
        `Engagement rate improving: ${a.avgEngagementRate.d30}% vs ${a.avgEngagementRate.prev30}% the previous month`,
      );
    if (a.topPosts[0])
      working.push(
        `Best post ("${a.topPosts[0].caption.slice(0, 40)}…", ${a.topPosts[0].format}) hit ${a.topPosts[0].er}% ER — the ${a.topPosts[0].format} format is resonating`,
      );
    if (a.reach.trend === "up") working.push("Reach is trending up over the last two weeks");

    if (a.reach.trend === "down") notWorking.push("Reach declined over the last two weeks");
    if ((a.avgEngagementRate.d30 ?? 0) < (a.avgEngagementRate.prev30 ?? 0))
      notWorking.push(
        `Engagement rate slipping: ${a.avgEngagementRate.d30}% vs ${a.avgEngagementRate.prev30}% previously`,
      );
    if (a.cadence.gapDaysMax > 7)
      notWorking.push(
        `Inconsistent cadence — longest gap between posts was ${a.cadence.gapDaysMax} days (algorithms reward consistency)`,
      );
    if (a.cadence.postsPerWeekD30 < 2)
      notWorking.push(
        `Only ${a.cadence.postsPerWeekD30} posts/week in the last 30 days — below the platform's momentum threshold`,
      );
    if (working.length === 0) working.push("Stable baseline to build from");
    if (notWorking.length === 0) notWorking.push("No red flags in this window");

    return {
      accountHandle: a.handle,
      platform: a.platform,
      grade: g,
      working,
      notWorking,
      recommendations: [
        {
          action: `Double down on ${fmt} posts in the ${time.label} window (~${time.timeLocal})`,
          why: `Your histogram shows ${time.label} is your most active posting window and ${fmt} is your best-performing format — compounding what already works beats experiments.`,
          impact: "high" as const,
          effort: "low" as const,
        },
        {
          action: `Lift cadence to ${Math.max(3, Math.ceil(a.cadence.postsPerWeekD30 + 1))} posts/week`,
          why: "Early engagement velocity compounds on every platform; consistent cadence keeps you in the distribution test pool.",
          impact: "medium" as const,
          effort: "medium" as const,
        },
        {
          action: "Rework the first 2 seconds / first line of underperformers",
          why: `Bottom posts (e.g. "${a.bottomPosts[0]?.caption.slice(0, 30) ?? "—"}…") lag on hook strength; scroll-stop rate decides reach before quality does.`,
          impact: "high" as const,
          effort: "low" as const,
        },
      ],
    };
  });

  const best = summary.crossPlatform.bestPlatformByER;
  const fastest = summary.crossPlatform.fastestGrowing;

  return {
    overallSummary: `Across ${summary.accounts.length} accounts, ${best ?? "your strongest account"} leads on engagement and ${fastest ?? "your fastest account"} on growth. ${summary.crossPlatform.underperforming.length ? `Attention needed: ${summary.crossPlatform.underperforming.join(", ")}.` : "No accounts are in decline this window."} The single biggest lever is consistency in each account's proven format + time window.`,
    perAccount,
    quickWins: [
      `Repost your best performer's angle on ${best ?? "your top account"} in a fresh variation this week`,
      "Move every post into its account's best time bucket (see histograms)",
      "Add a question or CTA-to-comment on the next 5 posts — comment velocity is an early ranking signal everywhere",
      "Cross-promote your fastest-growing account from the others once this week",
    ],
  };
}

export function demoContentPlan(summary: MetricSummary): ContentPlan {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  const items: ContentPlan["items"] = [];
  const topics = [
    "Behind the scenes of how it's made",
    "Customer result / testimonial spotlight",
    "3 tips your audience can use today",
    "Myth vs fact in your niche",
    "Founder story moment",
    "Product in action (real use, not studio)",
    "Community question / poll",
    "Before → after transformation",
    "A day in the life",
    "Trend remix with your product's spin",
    "FAQ answered in 30 seconds",
    "Sneak peek of what's coming",
    "User-generated content reshare",
    "Hot take on an industry norm",
  ];

  const auto = summary.accounts.filter((a) => a.mode !== "manual");
  for (let day = 0; day < 14; day++) {
    const account = auto[day % Math.max(1, auto.length)];
    if (!account) break;
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + day);
    const date = d.toISOString().slice(0, 10);
    const fmt = bestFormat(account);
    const time = bestTimeBucket(account);
    const topic = topics[day % topics.length];
    items.push({
      date,
      timeLocal: time.timeLocal,
      platforms: [account.platform],
      format: fmt,
      topic,
      hook: `${topic.split(" ")[0]} — but not the way you think`,
      draftCaption: `${topic}. Here's the part nobody shows you 👇\n\n(1) the real process, (2) what went wrong, (3) what we'd do differently.\n\nWhich one surprised you? Tell us below.`,
      hashtags: ["#" + account.handle.replace(/[^a-z0-9]/gi, "").slice(0, 12), "#behindthescenes"],
      mediaBrief: `${fmt} shot on phone, natural light, first frame must show the end result; captions burned in.`,
      playbookJustification: `${PLATFORM_LABELS[account.platform]} rewards ${fmt} with strong completion/early engagement; ${time.label} is this account's most active window.`,
    });
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 13);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    rationale:
      "Round-robin across your auto-postable accounts, each item in that account's best-performing format and most active time window, alternating value / proof / community topics so the feed never repeats itself two days in a row.",
    items,
  };
}

export function demoPostIdeas(
  summary: MetricSummary,
  platform: PlatformId,
): PostIdeas {
  const account =
    summary.accounts.find((a) => a.platform === platform) ?? summary.accounts[0];
  const time = account ? bestTimeBucket(account) : { label: "evening", timeLocal: "19:00" };
  const fmt = account ? bestFormat(account) : "video";
  const hooks = [
    "Stop doing this if you want [outcome]",
    "We tested it so you don't have to",
    "The 10-second version of what took us 3 years",
    "Nobody talks about this part",
    "POV: you finally found the one that works",
    "3 mistakes we made so you don't",
  ];
  return {
    platform,
    ideas: hooks.map((hook, i) => ({
      hook,
      caption: `${hook}.\n\nHere's the breakdown — save this for later.\n\n${i % 2 === 0 ? "Which would you try first?" : "Tag someone who needs this."}`,
      format: fmt,
      bestTimeLocal: time.timeLocal,
      why: `Curiosity-gap hook + ${fmt} (your best format on this account) posted in the ${time.label} window where your audience is most active.`,
    })),
  };
}

export function demoWeeklyReview(summary: MetricSummary): WeeklyReview {
  const wins: string[] = [];
  const concerns: string[] = [];
  for (const a of summary.accounts) {
    if (a.reach.trend === "up") wins.push(`${a.handle}: reach trending up (${a.reach.d7.toLocaleString()} this week)`);
    if ((a.followers.d30Pct ?? 0) > 5) wins.push(`${a.handle}: +${a.followers.d30Pct}% followers this month`);
    if (a.reach.trend === "down") concerns.push(`${a.handle}: reach declining week-over-week`);
    if (a.cadence.gapDaysMax > 7) concerns.push(`${a.handle}: ${a.cadence.gapDaysMax}-day posting gap`);
    if (a.anomalies[0]) wins.push(`${a.handle}: ${a.anomalies[0]} — find what caused it and repeat it`);
  }
  return {
    headline: `${summary.crossPlatform.fastestGrowing ?? "Your accounts"} led growth this week; focus next week on converting reach into engagement.`,
    wins: wins.slice(0, 5).length ? wins.slice(0, 5) : ["Baseline held steady across accounts"],
    concerns: concerns.slice(0, 5).length ? concerns.slice(0, 5) : ["No significant declines"],
    nextWeekFocus: [
      "Ship every post inside its account's best time window",
      "One collaborative/UGC post on your fastest-growing account",
      "Reply to every comment within 60 minutes of posting (early engagement velocity)",
    ],
  };
}

export function demoAdBrief(
  summary: MetricSummary,
  params: { product?: string; goal?: string; accountIds?: string[] },
): AdBrief {
  const product = params.product || "your product";
  const goal = params.goal || "sales";
  const chosen = params.accountIds?.length
    ? summary.accounts.filter((a) => params.accountIds!.includes(a.accountId))
    : summary.accounts.filter((a) => a.mode !== "manual").slice(0, 3);

  return {
    product,
    goal,
    audiencePersona: {
      description: `The engaged follower profile behind your best posts: values authenticity over polish, discovers via short video, buys after 2-3 touchpoints of social proof.`,
      painPoints: [
        "Skeptical of ads that look like ads",
        "No time to research — wants proof fast",
        "Fear of wasting money on another disappointment",
      ],
      desires: [
        "Feel like an insider who found it first",
        "Visible results they can share",
        "A brand whose values match theirs",
      ],
    },
    coreAngle: `Show, don't claim: real ${product} results from real people, framed as the discovery the viewer almost missed.`,
    perPlatform: chosen.map((a) => {
      const fmt = bestFormat(a);
      const time = bestTimeBucket(a);
      return {
        platform: a.platform,
        accountHandle: a.handle,
        format: fmt,
        hook: `POV: you almost scrolled past the ${product} that actually works`,
        script: [
          { step: "0-2s", direction: "Open on the END result (pattern interrupt — no logo, no intro)" },
          { step: "2-7s", direction: "One-line problem statement over quick cuts of the struggle" },
          { step: "7-18s", direction: `${product} in real use — imperfect lighting, real hands, captions burned in` },
          { step: "18-25s", direction: "Social proof beat: review screenshot or duet/stitch of a customer" },
          { step: "25-30s", direction: "Single CTA on screen + verbal (one action only)" },
        ],
        caption: `We didn't expect this either. ${product} — see why everyone's switching. Link in bio (today only: free shipping).`,
        hashtags: ["#" + a.handle.replace(/[^a-z0-9]/gi, "").slice(0, 12), "#tiktokmademebuyit"],
        cta: goal === "sales" ? "Shop now — link in bio" : "Follow for part 2",
        thumbnailConcept: "Close-up of the result with a 3-word overlay ('It actually works')",
        soundOrTrend: "Current trending audio in your niche (swap weekly; originality bonus if you record your own)",
        psychologyNotes: [
          { element: "Result-first open", principle: "Curiosity gap + loss aversion", why: "Viewer must know how you got there; leaving feels like losing the answer." },
          { element: "Review screenshot beat", principle: "Social proof (Cialdini)", why: "UGC-style proof outperforms brand claims for skeptical buyers." },
          { element: "'Today only' shipping line", principle: "Scarcity/urgency (ethical)", why: "A real, small deadline converts fence-sitters without a fake countdown." },
          { element: "Single CTA", principle: "Choice architecture", why: "One action removes decision friction; multiple CTAs depress all of them." },
        ],
        metricRationale: `${a.handle}'s best format is ${fmt} and its audience is most active in the ${time.label} window (~${time.timeLocal}) — schedule the first flight there. Current ER ${a.avgEngagementRate.d30 ?? "—"}%.`,
      };
    }),
    caseStudyReferences: [
      "e.l.f. Cosmetics 'Eyes Lips Face' — original sound + UGC flywheel pattern",
      "Stanley cup fire-car response — social proof moment amplified by the brand",
      "Duolingo unhinged mascot — platform-native tone beats ad polish",
    ],
  };
}
