/** Sites-only model experiment; an explicit override preserves reproducible comparisons. */
export function getSiteModelOptions(
  model = process.env.SITES_MODEL || "anthropic/claude-opus-5.5",
  effort: "high" | "medium" = "high",
) {
  return {
    model,
    ...(model.startsWith("anthropic/claude-opus-")
      ? {
          maxOutputTokens: 32768,
          providerOptions: {
            anthropic: { thinking: { type: "adaptive" as const }, effort },
          },
        }
      : {}),
  };
}
