import { generateObject } from "ai";
import { z } from "zod";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { requireCredits } from "./requireCredits";
/** All creative model calls use the same metering path as chat. */
export async function generateProductionObject<T extends Record<string, unknown>>(
  schema: z.ZodType<T>,
  system: string,
  input: unknown,
  images: string[],
  accountId: string,
  siteId: string,
) {
  await requireCredits(accountId);
  const model = process.env.SITES_MODEL || "openai/gpt-6-astra";
  const result = await generateObject({
    model,
    output: "object",
    schema: schema as z.ZodType<Record<string, unknown>>,
    maxRetries: 0,
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: JSON.stringify(input) },
          ...images.map(image => ({
            type: "image" as const,
            image: image.startsWith("data:") ? image : new URL(image),
          })),
        ],
      },
    ],
  });
  await handleChatCredits({
    usage: result.usage,
    model,
    accountId,
    source: "api",
    resourceUrl: `/sites/${siteId}`,
  });
  return schema.parse(result.object);
}
