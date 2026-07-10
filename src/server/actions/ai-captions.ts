"use server";

import { z } from "zod";
import {
  getAnthropicClient,
  getAiModel,
  recordAiUsage,
} from "@/lib/ai/client";
import { KNOWLEDGE } from "@/lib/ai/knowledge";
import { PLATFORM_LABELS } from "@/lib/metrics/colors";
import { PLATFORM_IDS, type PlatformId } from "@/lib/connectors/types";

/**
 * "Write it for me": three caption options from a one-line brief.
 * Claude when a key is set (grounded in the selling-psychology playbook
 * plus the first target platform's algorithm notes); a deterministic
 * template engine otherwise, clearly labeled demo.
 */

const inputSchema = z.object({
  brief: z.string().trim().min(3).max(500),
  platformIds: z.array(z.enum(PLATFORM_IDS)).max(8),
});

export interface CaptionResult {
  ok: boolean;
  options: string[];
  generatedBy: "claude" | "demo";
  message?: string;
}

function demoOptions(brief: string): string[] {
  const clean = brief.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  const topic = clean.charAt(0).toUpperCase() + clean.slice(1);
  const tag = clean
    .split(" ")
    .filter((w) => w.length > 3)
    .slice(0, 2)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .join("");
  return [
    `${topic} — and here's the part nobody tells you. 👀 Save this for later.${tag ? ` #${tag}` : ""}`,
    `We asked, you voted: ${clean}. Drop a 🔥 if you're in — full story in the comments.`,
    `POV: ${clean}. Three things that made it work — swipe through, then tell us which one you'd try first.${tag ? ` #${tag} #behindthescenes` : ""}`,
  ];
}

export async function generateCaptionAction(
  input: z.infer<typeof inputSchema>,
): Promise<CaptionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      options: [],
      generatedBy: "demo",
      message: "Give the writer a short brief (a few words about the post).",
    };
  }
  const { brief, platformIds } = parsed.data;

  const client = await getAnthropicClient();
  if (!client) {
    return { ok: true, options: demoOptions(brief), generatedBy: "demo" };
  }

  try {
    const model = await getAiModel();
    const primary = (platformIds[0] ?? "instagram") as PlatformId;
    const platformNames = platformIds.map((p) => PLATFORM_LABELS[p]).join(", ");
    const system = [
      "You write social media captions that sell without sounding like ads.",
      "Ground every option in these playbooks:",
      "--- SELLING PSYCHOLOGY (excerpt) ---",
      KNOWLEDGE.psychology.selling.slice(0, 2500),
      `--- ${PLATFORM_LABELS[primary].toUpperCase()} ALGORITHM NOTES (excerpt) ---`,
      KNOWLEDGE.algorithms[primary].slice(0, 1500),
      "--- RULES ---",
      "Return EXACTLY three caption options separated by a line containing only '---'.",
      "No preamble, no numbering, no explanations — just the three captions.",
      "Each stands alone, hooks in the first line, ends with a natural CTA; hashtags only where the platform rewards them.",
    ].join("\n");

    const response = await client.messages.create({
      model,
      max_tokens: 700,
      system,
      messages: [
        {
          role: "user",
          content: `Brief: ${brief}\nTarget platforms: ${platformNames || "general"}`,
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
      .join("")
      .trim();
    const options = text
      .split(/\n\s*---\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (options.length === 0) {
      return { ok: true, options: demoOptions(brief), generatedBy: "demo" };
    }
    return { ok: true, options, generatedBy: "claude" };
  } catch {
    // Claude hiccuped — the demo engine keeps the flow moving.
    return {
      ok: true,
      options: demoOptions(brief),
      generatedBy: "demo",
      message: "Claude was unreachable — these are template drafts instead.",
    };
  }
}
