import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { aiConversations, aiMessages } from "@/lib/db/schema";
import { buildMetricSummary } from "@/lib/metrics/summary";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import {
  friendlyAiError,
  getAiModel,
  getAnthropicClient,
  recordAiUsage,
} from "@/lib/ai/client";
import { formatPct } from "@/lib/metrics/engagement";

export const maxDuration = 120;

const uuid = () => crypto.randomUUID();

const bodySchema = z.object({
  conversationId: z.string().nullish(),
  message: z.string().min(1).max(8000),
  accountIds: z.array(z.string()).nullish(),
});

const encoder = new TextEncoder();
const sse = (data: Record<string, unknown>) =>
  encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

/** Deterministic, data-aware chat reply for demo mode (no API key). */
function demoChatReply(
  summary: Awaited<ReturnType<typeof buildMetricSummary>>,
): string {
  const best = summary.accounts.find(
    (a) => a.handle === summary.crossPlatform.bestPlatformByER,
  );
  const fastest = summary.accounts.find(
    (a) => a.handle === summary.crossPlatform.fastestGrowing,
  );
  const lines = [
    "**Demo strategist** (add an Anthropic API key in Settings for the full conversational AI — this preview uses your real numbers with canned analysis).",
    "",
    `Here's what your last ${summary.rangeDays} days say:`,
  ];
  if (best) {
    lines.push(
      `- **${best.handle}** leads on engagement at ${formatPct(best.avgEngagementRate.d30)} — its best format is ${Object.entries(best.formatMix).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "video"}. Double down there.`,
    );
  }
  if (fastest && fastest.handle !== best?.handle) {
    lines.push(
      `- **${fastest.handle}** is growing fastest (+${fastest.followers.d30Pct ?? 0}% this month, ${fastest.followers.d30Delta?.toLocaleString() ?? "—"} net followers).`,
    );
  }
  for (const a of summary.accounts.slice(0, 6)) {
    if (a.anomalies[0]) {
      lines.push(`- **${a.handle}**: ${a.anomalies[0]} — worth reverse-engineering.`);
      break;
    }
  }
  if (summary.crossPlatform.underperforming.length) {
    lines.push(
      `- Needs attention: ${summary.crossPlatform.underperforming.join(", ")} (declining reach or ER).`,
    );
  }
  lines.push(
    "",
    "Try the **Reports** tab: Account audit, a 2-week content plan, or the Ad Builder — they all work in demo mode too.",
  );
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { message, accountIds } = parsed.data;
  const db = await getDb();

  // Ensure conversation.
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const exists = await db.query.aiConversations.findFirst({
      where: (c, { eq }) => eq(c.id, conversationId!),
    });
    if (!exists) conversationId = null;
  }
  if (!conversationId) {
    conversationId = uuid();
    await db.insert(aiConversations).values({
      id: conversationId,
      title: message.slice(0, 60),
    });
  }
  await db.insert(aiMessages).values({
    id: uuid(),
    conversationId,
    role: "user",
    content: message,
  });

  const history = await db.query.aiMessages.findMany({
    where: (m, { eq }) => eq(m.conversationId, conversationId!),
    orderBy: (m, { asc }) => asc(m.createdAt),
    limit: 30,
  });

  const summary = await buildMetricSummary({
    accountIds: accountIds ?? undefined,
    rangeDays: 90,
  });
  const system = buildSystemPrompt("chat", summary);
  const client = await getAnthropicClient();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: Record<string, unknown>) => controller.enqueue(sse(d));
      send({ conversationId });
      try {
        if (!client) {
          // Demo mode: stream the canned-but-data-aware reply in chunks.
          const reply = demoChatReply(summary);
          for (let i = 0; i < reply.length; i += 80) {
            send({ text: reply.slice(i, i + 80) });
            await new Promise((r) => setTimeout(r, 24));
          }
          await db.insert(aiMessages).values({
            id: uuid(),
            conversationId: conversationId!,
            role: "assistant",
            content: reply,
            contextMeta: { generatedBy: "demo" },
          });
          send({ done: true });
          controller.close();
          return;
        }

        const model = await getAiModel();
        const anthropicStream = client.messages.stream({
          model,
          max_tokens: 4000,
          system,
          messages: history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        });

        anthropicStream.on("text", (delta) => send({ text: delta }));

        const final = await anthropicStream.finalMessage();
        const fullText = final.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
        await db.insert(aiMessages).values({
          id: uuid(),
          conversationId: conversationId!,
          role: "assistant",
          content: fullText,
          contextMeta: { generatedBy: "claude", model },
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
        });
        await recordAiUsage(final.usage.input_tokens, final.usage.output_tokens);
        send({ done: true });
      } catch (err) {
        send({ error: friendlyAiError(err) });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
