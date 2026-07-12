import type { PlatformId } from "@/lib/connectors/types";
import type { MetricSummary } from "@/lib/metrics/summary";
import { KNOWLEDGE } from "./knowledge";
import type { ReportType } from "./contracts";

/**
 * System prompt assembly. Stable framing first (cache-friendly), then the
 * scoped knowledge base, then the metric summary, then task framing.
 */

const ROLE = `You are Branch's social media strategist — the in-house growth and marketing brain for a single owner managing their brand's accounts across platforms.

Grounding rules:
- Only cite numbers that appear in the metric summary. Never invent metrics.
- Be concrete: name formats, hooks, posting times, cadences — not vague advice.
- Tie recommendations to the platform algorithm signals and psychology principles in your knowledge base, and say which ones you're using.
- When you reference a case study, name it and state the transferable pattern.
- Mark speculation clearly ("hypothesis:").
- Be direct about problems. The owner needs truth, not encouragement.`;

function knowledgeFor(
  platforms: PlatformId[],
  opts: { caseStudies?: boolean; influencers?: boolean; psychology?: boolean },
): string {
  const parts: string[] = [];
  for (const p of platforms) {
    parts.push(`## Algorithm playbook: ${p}\n${KNOWLEDGE.algorithms[p]}`);
  }
  if (opts.caseStudies) {
    for (const p of platforms) {
      parts.push(`## Case studies: ${p}\n${KNOWLEDGE.caseStudies[p]}`);
    }
  }
  if (opts.influencers) {
    for (const p of platforms) {
      parts.push(`## Influencer ideals: ${p}\n${KNOWLEDGE.influencers[p]}`);
    }
  }
  if (opts.psychology) {
    parts.push(`## Selling psychology\n${KNOWLEDGE.psychology.selling}`);
    parts.push(`## Attention psychology\n${KNOWLEDGE.psychology.attention}`);
  }
  return parts.join("\n\n");
}

const TASK_FRAMING: Record<ReportType, string> = {
  account_audit:
    "Task: audit every account in the summary. Grade each (A–F) on growth + engagement trajectory relative to its platform's norms. List what's working and what isn't, grounded in the data. Give prioritized recommendations with impact/effort ratings, and finish with 3-5 quick wins the owner can do this week.",
  content_plan:
    "Task: produce a 14-day content plan starting tomorrow. Schedule items on specific dates and local times chosen from each account's best posting-time buckets. Choose formats the data says perform. Each item needs a scroll-stopping hook, a ready-to-post draft caption, hashtags, a media brief (what to shoot/design), and a one-line justification citing an algorithm signal from the playbooks.",
  post_ideas:
    "Task: generate 6 post ideas for the requested platform, each with a hook (first 1-2 seconds / first line), full caption, format, best local posting time from the data, and why it should work (cite a playbook signal or case-study pattern).",
  weekly_review:
    "Task: review the last 7 days vs the prior period. One headline sentence, 3-5 wins, 3-5 concerns, and next week's focus list. Numbers from the summary only.",
  ad_brief:
    "Task: act as an ad builder. Using the product/offer and goal provided, build a campaign brief per selected account: audience persona (pains + desires), core angle, and for each platform a complete creative spec — format, hook, step-by-step script/shot list (or carousel/pin structure), caption, hashtags, single CTA, thumbnail/cover concept, sound or trend suggestion. Annotate every element with the persuasion principle it uses (Cialdini, AIDA, hook-story-offer, loss aversion...) and why. Ground format/timing choices in the account's own metrics and cite at least 2 relevant case-study patterns by name.",
};

export function buildSystemPrompt(
  task: ReportType | "chat",
  summary: MetricSummary,
  extras: {
    params?: Record<string, unknown>;
    /** Trend Radar digest — what's hot in the owner's niches right now. */
    trends?: string | null;
  } = {},
): string {
  const platforms = [...new Set(summary.accounts.map((a) => a.platform))];
  const knowledgeOpts =
    task === "ad_brief"
      ? { caseStudies: true, influencers: true, psychology: true }
      : task === "content_plan" || task === "post_ideas"
        ? { caseStudies: true, influencers: true, psychology: true }
        : task === "chat"
          ? { caseStudies: true, psychology: true }
          : { psychology: true };

  const sections = [
    ROLE,
    `# Marketing knowledge base\n${knowledgeFor(platforms, knowledgeOpts)}`,
    `# Metric summary (${summary.rangeDays} days, generated ${summary.generatedAt})\n<metric_summary>\n${JSON.stringify(summary, null, 1)}\n</metric_summary>`,
  ];

  if (extras.trends) {
    sections.push(
      `# Trend Radar — live niche signals\nRecent keyword scans of the owner's niche (real posts + AI patterns). Use these to keep recommendations current; cite a signal or pattern when you lean on it, and say if it came from demo signals.\n${extras.trends}`,
    );
  }

  if (task !== "chat") {
    sections.push(`# Current task\n${TASK_FRAMING[task]}`);
    if (extras.params && Object.keys(extras.params).length > 0) {
      sections.push(`# Task parameters\n${JSON.stringify(extras.params, null, 1)}`);
    }
  } else {
    sections.push(
      "# Mode\nConversational strategist. Answer questions about the data, brainstorm, and advise. Keep responses focused and scannable with short headings or bullets where it helps.",
    );
  }

  return sections.join("\n\n---\n\n");
}
