import { eq } from "drizzle-orm";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Db } from "@/lib/db/client";
import { aiReports } from "@/lib/db/schema";
import { buildMetricSummary } from "@/lib/metrics/summary";
import type { MetricSummary } from "@/lib/metrics/summary";
import { REPORT_TYPES, type ReportType } from "./contracts";
import { buildSystemPrompt } from "./prompts";
import {
  friendlyAiError,
  getAiModel,
  getAnthropicClient,
  recordAiUsage,
} from "./client";
import {
  demoAccountAudit,
  demoAdBrief,
  demoContentPlan,
  demoPostIdeas,
  demoWeeklyReview,
} from "./demo-analysis";
import type { PlatformId } from "@/lib/connectors/types";

function demoResult(
  type: ReportType,
  summary: MetricSummary,
  params: Record<string, unknown>,
): unknown {
  switch (type) {
    case "account_audit":
      return demoAccountAudit(summary);
    case "content_plan":
      return demoContentPlan(summary);
    case "post_ideas":
      return demoPostIdeas(summary, (params.platform as PlatformId) ?? "instagram");
    case "weekly_review":
      return demoWeeklyReview(summary);
    case "ad_brief":
      return demoAdBrief(summary, params as { product?: string; goal?: string; accountIds?: string[] });
  }
}

/** Generates an AI report — Claude when a key is configured, demo otherwise. */
export async function runAiReportJob(db: Db, reportId: string): Promise<void> {
  const report = await db.query.aiReports.findFirst({
    where: (r, { eq: e }) => e(r.id, reportId),
  });
  if (!report || report.status === "complete") return;
  const type = report.type as ReportType;
  if (!REPORT_TYPES[type]) {
    await db
      .update(aiReports)
      .set({ status: "failed", error: `Unknown report type: ${report.type}` })
      .where(eq(aiReports.id, reportId));
    return;
  }

  await db
    .update(aiReports)
    .set({ status: "running", error: null })
    .where(eq(aiReports.id, reportId));

  try {
    const params = report.params ?? {};
    const accountIds = Array.isArray(params.accountIds)
      ? (params.accountIds as string[])
      : undefined;
    const summary = await buildMetricSummary({ accountIds });

    let result: unknown;
    let generatedBy: "claude" | "demo";
    let model: string | null = null;

    const client = await getAnthropicClient();
    if (client) {
      model = await getAiModel();
      const schema = REPORT_TYPES[type].schema;
      const response = await client.messages.parse({
        model,
        max_tokens: 16000,
        system: buildSystemPrompt(type, summary, { params }),
        messages: [
          {
            role: "user",
            content:
              "Produce the report defined in the task section, grounded in the metric summary.",
          },
        ],
        output_config: { format: zodOutputFormat(schema) },
      });
      if (!response.parsed_output) {
        throw new Error("The model's output didn't match the report schema — try again.");
      }
      result = response.parsed_output;
      generatedBy = "claude";
      await recordAiUsage(response.usage.input_tokens, response.usage.output_tokens);
    } else {
      result = demoResult(type, summary, params);
      generatedBy = "demo";
    }

    await db
      .update(aiReports)
      .set({
        status: "complete",
        result: result as Record<string, unknown>,
        inputSummary: summary as unknown as Record<string, unknown>,
        generatedBy,
        model,
        completedAt: new Date(),
      })
      .where(eq(aiReports.id, reportId));
  } catch (err) {
    await db
      .update(aiReports)
      .set({ status: "failed", error: friendlyAiError(err) })
      .where(eq(aiReports.id, reportId));
  }
}
