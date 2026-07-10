import { z } from "zod";
import { PLATFORM_IDS } from "@/lib/connectors/types";

/**
 * Output contracts shared by the Claude structured-output path and the
 * demo analysis engine — one schema, identical UI rendering for both.
 */

const platformEnum = z.enum(PLATFORM_IDS);

export const AccountAuditSchema = z.object({
  overallSummary: z.string(),
  perAccount: z.array(
    z.object({
      accountHandle: z.string(),
      platform: platformEnum,
      grade: z.enum(["A", "B", "C", "D", "F"]),
      working: z.array(z.string()),
      notWorking: z.array(z.string()),
      recommendations: z.array(
        z.object({
          action: z.string(),
          why: z.string(),
          impact: z.enum(["high", "medium", "low"]),
          effort: z.enum(["high", "medium", "low"]),
        }),
      ),
    }),
  ),
  quickWins: z.array(z.string()),
});
export type AccountAudit = z.infer<typeof AccountAuditSchema>;

export const ContentPlanSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  rationale: z.string(),
  items: z.array(
    z.object({
      date: z.string(),
      timeLocal: z.string(),
      platforms: z.array(platformEnum),
      format: z.string(),
      topic: z.string(),
      hook: z.string(),
      draftCaption: z.string(),
      hashtags: z.array(z.string()),
      mediaBrief: z.string(),
      playbookJustification: z.string(),
    }),
  ),
});
export type ContentPlan = z.infer<typeof ContentPlanSchema>;

export const PostIdeasSchema = z.object({
  platform: platformEnum,
  ideas: z.array(
    z.object({
      hook: z.string(),
      caption: z.string(),
      format: z.string(),
      bestTimeLocal: z.string(),
      why: z.string(),
    }),
  ),
});
export type PostIdeas = z.infer<typeof PostIdeasSchema>;

export const WeeklyReviewSchema = z.object({
  headline: z.string(),
  wins: z.array(z.string()),
  concerns: z.array(z.string()),
  nextWeekFocus: z.array(z.string()),
});
export type WeeklyReview = z.infer<typeof WeeklyReviewSchema>;

/** Ad-builder-grade campaign brief: creative spec + psychology annotations. */
export const AdBriefSchema = z.object({
  product: z.string(),
  goal: z.string(),
  audiencePersona: z.object({
    description: z.string(),
    painPoints: z.array(z.string()),
    desires: z.array(z.string()),
  }),
  coreAngle: z.string(),
  perPlatform: z.array(
    z.object({
      platform: platformEnum,
      accountHandle: z.string(),
      format: z.string(),
      hook: z.string(),
      script: z.array(
        z.object({
          step: z.string(),
          direction: z.string(),
        }),
      ),
      caption: z.string(),
      hashtags: z.array(z.string()),
      cta: z.string(),
      thumbnailConcept: z.string(),
      soundOrTrend: z.string(),
      psychologyNotes: z.array(
        z.object({
          element: z.string(),
          principle: z.string(),
          why: z.string(),
        }),
      ),
      metricRationale: z.string(),
    }),
  ),
  caseStudyReferences: z.array(z.string()),
});
export type AdBrief = z.infer<typeof AdBriefSchema>;

export const REPORT_TYPES = {
  account_audit: { label: "Account audit", schema: AccountAuditSchema },
  content_plan: { label: "2-week content plan", schema: ContentPlanSchema },
  post_ideas: { label: "Post ideas", schema: PostIdeasSchema },
  weekly_review: { label: "Weekly review", schema: WeeklyReviewSchema },
  ad_brief: { label: "Ad Builder brief", schema: AdBriefSchema },
} as const;

export type ReportType = keyof typeof REPORT_TYPES;
