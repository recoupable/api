/** Existing pack settings shared by quote identity and execution. Bump adapter_version for recipe changes. */
export const packExecutionSettings = {
  adapter_version: "release-pack-production-v1",
  pricing_version: "release-pack-house-rates-v1",
  image: { num_images: 1, output_format: "png", sync_mode: false, aspect_ratio: "9:16" },
  motion: {
    resolution: "768P",
    prompt_expansion_mode: "balanced",
    enable_safety_checker: true,
    sync_mode: false,
  },
  caption: { maxOutputTokens: 350, maxRetries: 0 },
  stillInspection: { maxOutputTokens: 600 },
  videoInspection: { temperature: 0, max_tokens: 600 },
  analysis: { max_new_tokens: 768, temperature: 0, do_sample: false },
} as const;
