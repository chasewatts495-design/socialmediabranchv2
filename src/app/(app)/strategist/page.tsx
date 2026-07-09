import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiReports } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { ChatPanel, type ChatMessage } from "@/components/strategist/ChatPanel";
import {
  ReportsPanel,
  type ReportRow,
  type StrategistAccount,
} from "@/components/strategist/ReportsPanel";
import { StrategistTabs } from "@/components/strategist/StrategistTabs";
import { Badge } from "@/components/ui/primitives";
import type { PlatformId } from "@/lib/connectors/types";

export const dynamic = "force-dynamic";

export default async function StrategistPage() {
  const db = await getDb();

  const [latestConversation, reportRows, accountRows, apiKey] = await Promise.all([
    db.query.aiConversations.findFirst({
      orderBy: (c, { desc: d }) => d(c.updatedAt),
      with: { messages: { orderBy: (m, { asc }) => asc(m.createdAt), limit: 60 } },
    }),
    db.select().from(aiReports).orderBy(desc(aiReports.createdAt)).limit(12),
    db.query.accounts.findMany({ orderBy: (a, { asc }) => asc(a.sortOrder) }),
    getSetting("anthropic.apiKey"),
  ]);

  const aiEnabled = Boolean(apiKey);
  const messages: ChatMessage[] = (latestConversation?.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }));
  const reports: ReportRow[] = reportRows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    generatedBy: r.generatedBy,
    model: r.model,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    result: r.result,
  }));
  const accounts: StrategistAccount[] = accountRows.map((a) => ({
    id: a.id,
    handle: a.handle,
    platformId: a.platformId as PlatformId,
    mode: a.mode,
  }));

  return (
    <div className="fade-up">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            AI Strategist
          </h1>
          <p className="mt-0.5 text-xs text-muted md:text-sm">
            Trained on platform algorithms, case studies, influencer playbooks,
            and selling psychology — grounded in your real numbers.
          </p>
        </div>
        <Badge tone={aiEnabled ? "success" : "info"}>
          {aiEnabled ? "Claude connected" : "Demo mode"}
        </Badge>
      </div>

      <StrategistTabs
        chat={
          <ChatPanel
            conversationId={latestConversation?.id ?? null}
            initialMessages={messages}
          />
        }
        reports={
          <ReportsPanel reports={reports} accounts={accounts} aiEnabled={aiEnabled} />
        }
      />
    </div>
  );
}
