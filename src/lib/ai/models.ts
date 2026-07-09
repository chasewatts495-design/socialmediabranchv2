/** Client-safe constants (no server imports). */
export const DEFAULT_MODEL = "claude-sonnet-5";

export const AI_MODELS = [
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 (recommended)" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 (most capable, pricier)" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fastest, cheapest)" },
] as const;
