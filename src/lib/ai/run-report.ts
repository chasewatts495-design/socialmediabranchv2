import type { Db } from "@/lib/db/client";

/** Fleshed out in the AI Strategist milestone. */
export async function runAiReportJob(db: Db, reportId: string): Promise<void> {
  void db;
  throw new Error(`AI report ${reportId}: strategist not wired yet`);
}
