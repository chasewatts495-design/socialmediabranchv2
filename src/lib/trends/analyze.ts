import { z } from "zod";
import {
  getAnthropicClient,
  getAiModel,
  recordAiUsage,
} from "@/lib/ai/client";
import { KNOWLEDGE } from "@/lib/ai/knowledge";
import { PLATFORM_LABELS } from "@/lib/metrics/colors";
import { PLATFORM_IDS, type PlatformId } from "@/lib/connectors/types";
import type { CreativeBrief, TrendReport, TrendSignal } from "./types";

/**
 * Turns raw viral signals into direction the owner can act on: what's
 * working in the niche, why, and 3 creative briefs shaped to their own
 * accounts. Claude when a key is set; a deterministic engine otherwise.
 */

export interface AnalyzeInput {
  keyword: string;
  signals: TrendSignal[];
  /** The owner's own accounts, strongest first. */
  accounts: { handle: string; platformId: PlatformId; engagementRate?: number }[];
  /** Best posting hour (UTC) per platform, when history exists. */
  bestHours: Partial<Record<PlatformId, number>>;
}

const reportSchema = z.object({
  summary: z.string().min(10).max(2000),
  patterns: z
    .array(
      z.object({
        name: z.string().min(2).max(120),
        why: z.string().min(2).max(600),
        playbook: z.string().min(2).max(600),
      }),
    )
    .min(1)
    .max(6),
  briefs: z
    .array(
      z.object({
        title: z.string().min(2).max(160),
        hook: z.string().min(2).max(300),
        caption: z.string().min(10).max(2200),
        platformId: z.enum(PLATFORM_IDS),
      }),
    )
    .min(1)
    .max(5),
});

function topSignals(signals: TrendSignal[], n: number): TrendSignal[] {
  return [...signals].sort((a, b) => b.heat - a.heat).slice(0, n);
}

export function demoReport(input: AnalyzeInput): TrendReport {
  const { keyword, signals, accounts, bestHours } = input;
  const top = topSignals(signals, 5);
  const video = signals.filter((s) => s.mediaType === "video").length;
  const videoShare = signals.length
    ? Math.round((video / signals.length) * 100)
    : 0;
  const platforms = [...new Set(signals.map((s) => s.platformId))];
  const own = accounts.length
    ? accounts
    : [{ handle: "your account", platformId: "instagram" as PlatformId }];

  const briefs: CreativeBrief[] = top.slice(0, 3).map((s, i) => {
    const target = own[i % own.length];
    return {
      title: `Ride "${s.title.slice(0, 60)}${s.title.length > 60 ? "…" : ""}"`,
      hook: `Open on the tension in the first line — "${keyword}: the part nobody shows you."`,
      caption: `${s.title.split(/[.!?]/)[0]}. We tried it with our own spin — here's the honest result. Save this if you're into ${keyword}, and tell us what to test next. #${keyword.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
      platformId: target.platformId,
      bestHourUtc: bestHours[target.platformId],
    };
  });

  return {
    summary: `Demo analysis (add an Anthropic key in Settings for the full strategist). "${keyword}" is moving on ${platforms.map((p) => PLATFORM_LABELS[p]).join(", ")} — ${videoShare}% of hot posts are video, and the biggest signal is pulling ${top[0]?.engagement.score.toLocaleString() ?? 0} engagements. First-person tests, honest rankings, and before/after reveals dominate the top slots.`,
    patterns: [
      {
        name: "First-person proof",
        why: `${Math.min(9, Math.max(3, Math.round(signals.length / 3)))} of the top posts are "I tried it" formats — audiences trust receipts over claims.`,
        playbook: "Show your own attempt with real numbers in frame within the first 2 seconds.",
      },
      {
        name: videoShare >= 50 ? "Video-first niche" : "Save-worthy lists",
        why:
          videoShare >= 50
            ? `${videoShare}% of hot signals are video — the feed is rewarding motion here.`
            : "Ranked lists and tier breakdowns are earning outsized saves and comments.",
        playbook:
          videoShare >= 50
            ? "Cut a 15–30s vertical clip per idea; hook line as on-screen text."
            : "Publish a carousel/thread ranking 5 options; invite disagreement in the CTA.",
      },
      {
        name: "Contrarian hooks",
        why: "Top titles frame a mistake or a myth — friction in the first line drives comments.",
        playbook: `Lead with "stop doing ${keyword} like…" and resolve it honestly by the end.`,
      },
    ],
    briefs,
    generatedBy: "demo",
  };
}

export async function analyzeTrends(input: AnalyzeInput): Promise<TrendReport> {
  const client = await getAnthropicClient();
  if (!client || input.signals.length === 0) return demoReport(input);

  try {
    const model = await getAiModel();
    const top = topSignals(input.signals, 24).map((s) => ({
      platform: s.platformId,
      title: s.title,
      author: s.author,
      score: s.engagement.score,
      comments: s.engagement.comments,
      views: s.engagement.views,
      mediaType: s.mediaType,
      heat: Number(s.heat.toFixed(2)),
      postedAt: s.postedAt,
    }));
    const ownPlatforms = [
      ...new Set(input.accounts.map((a) => a.platformId)),
    ] as PlatformId[];
    const algoNotes = ownPlatforms
      .slice(0, 3)
      .map(
        (p) =>
          `--- ${PLATFORM_LABELS[p].toUpperCase()} ALGORITHM (excerpt) ---\n${KNOWLEDGE.algorithms[p].slice(0, 900)}`,
      )
      .join("\n");

    const system = [
      "You are a social media trend analyst for a small brand owner.",
      "You receive live viral signals for a niche keyword and the owner's own accounts.",
      "Ground your advice in these playbooks:",
      "--- SELLING PSYCHOLOGY (excerpt) ---",
      KNOWLEDGE.psychology.selling.slice(0, 1800),
      algoNotes,
      "--- OUTPUT ---",
      'Reply with ONLY valid JSON: {"summary": string (<=120 words, concrete, cite real numbers from the signals), "patterns": [{"name", "why", "playbook"}] (3-5, each grounded in the actual signals), "briefs": [{"title", "hook", "caption", "platformId"}] (exactly 3, tailored to the OWNER\'S platforms, captions ready to paste)}.',
      `Valid platformId values: ${ownPlatforms.join(", ") || "instagram"}.`,
    ].join("\n");

    const response = await client.messages.create({
      model,
      max_tokens: 1600,
      system,
      messages: [
        {
          role: "user",
          content: `Keyword: ${input.keyword}\nOwner accounts: ${
            input.accounts
              .map(
                (a) =>
                  `${a.handle} (${PLATFORM_LABELS[a.platformId]}${
                    a.engagementRate
                      ? `, ER ${(a.engagementRate * 100).toFixed(1)}%`
                      : ""
                  })`,
              )
              .join("; ") || "none connected yet"
          }\nLive signals (ranked): ${JSON.stringify(top)}`,
        },
      ],
    });
    await recordAiUsage(
      response.usage.input_tokens,
      response.usage.output_tokens,
    );
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return demoReport(input);
    const parsed = reportSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    if (!parsed.success) return demoReport(input);

    const briefs: CreativeBrief[] = parsed.data.briefs.map((b) => ({
      ...b,
      platformId: b.platformId as PlatformId,
      bestHourUtc: input.bestHours[b.platformId as PlatformId],
    }));
    return {
      summary: parsed.data.summary,
      patterns: parsed.data.patterns,
      briefs,
      generatedBy: "claude",
    };
  } catch {
    return demoReport(input);
  }
}
