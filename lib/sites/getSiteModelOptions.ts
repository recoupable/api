/** Sites-only model experiment; an explicit override preserves reproducible comparisons. */
export function getSiteModelOptions(
  model = process.env.SITES_MODEL || "anthropic/claude-opus-5.5",
) {
  return {
    model,
    ...(model.startsWith("anthropic/claude-opus-")
      ? {
          providerOptions: {
            anthropic: { thinking: { type: "adaptive" as const }, effort: "high" as const },
          },
        }
      : {}),
  };
}
