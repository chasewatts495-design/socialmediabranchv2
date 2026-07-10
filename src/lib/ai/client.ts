import Anthropic from "@anthropic-ai/sdk";
import { getSetting, setSetting } from "@/lib/settings";

export { AI_MODELS, DEFAULT_MODEL } from "./models";
import { DEFAULT_MODEL } from "./models";

/** Client from the owner's stored key; null → demo mode. */
export async function getAnthropicClient(): Promise<Anthropic | null> {
  const key = await getSetting("anthropic.apiKey");
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export async function getAiModel(): Promise<string> {
  return (await getSetting("ai.model")) ?? DEFAULT_MODEL;
}

/** Accumulates token usage per calendar month (shown in Settings). */
export async function recordAiUsage(
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  const key = `ai.usage.${month}`;
  const current = await getSetting(key);
  let usage = { input: 0, output: 0 };
  if (current) {
    try {
      usage = JSON.parse(current) as { input: number; output: number };
    } catch {
      // reset on corruption
    }
  }
  usage.input += inputTokens;
  usage.output += outputTokens;
  await setSetting(key, JSON.stringify(usage));
}

export async function getAiUsageThisMonth(): Promise<{
  input: number;
  output: number;
} | null> {
  const month = new Date().toISOString().slice(0, 7);
  const raw = await getSetting(`ai.usage.${month}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { input: number; output: number };
  } catch {
    return null;
  }
}

/** Maps SDK errors to owner-friendly messages (most specific first). */
export function friendlyAiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Your Anthropic API key was rejected — check it in Settings.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Anthropic rate limit hit — wait a minute and try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach the Anthropic API — check your connection and retry.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Anthropic API error (${err.status ?? "?"}): ${err.message}`;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
