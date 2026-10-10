import { generateObject } from "ai";
import { z } from "zod";
import type { ContextEnrichmentResult } from "./runContextEnrichment";

/** Structured extraction with exact prompt/media tracing and no implicit retries. */
export async function generateContextObject(options: {
  system: string;
  input: unknown;
  schema: z.ZodType<Record<string, unknown>>;
  images?: string[];
}): Promise<ContextEnrichmentResult> {
  const started = Date.now();
  const model = "openai/gpt-6-astra";
  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: JSON.stringify(options.input) },
        ...(options.images ?? []).map(url => ({
          type: "image" as const,
          image: new URL(z.string().url().parse(url)),
        })),
      ],
    },
  ];
  const response = await generateObject({
    model,
    system: options.system,
    messages,
    schema: options.schema,
    maxRetries: 0,
    maxOutputTokens: 5000,
  });
  const metadata = z
    .object({
      gateway: z
        .object({ cost: z.union([z.number(), z.string()]).optional() })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .safeParse(response.providerMetadata);
  const rawCost = metadata.success ? metadata.data.gateway?.cost : undefined;
  const cost = rawCost === undefined || rawCost === "" ? NaN : Number(rawCost);
  const known = Number.isFinite(cost) && cost >= 0;
  // On the AI Gateway `response.modelId` echoes the requested id; only the gateway's raw body can
  // report the model that answered. Null when the body reports none.
  const reported = z
    .object({ response: z.object({ modelId: z.string().min(1) }).passthrough() })
    .passthrough()
    .safeParse(response.response?.body);
  return {
    content: response.object,
    coverage: "partial",
    costUsd: known ? cost : null,
    costStatus: known ? "confirmed" : "unknown",
    trace: {
      model,
      reportedModel: reported.success ? reported.data.response.modelId : null,
      system: options.system,
      messages,
      response: response.response,
      usage: response.usage,
      providerMetadata: response.providerMetadata,
      elapsedMs: Date.now() - started,
    },
  };
}
