import { getSiteModelOptions } from "../getSiteModelOptions";
import { loadSiteSkill } from "../skills/loadSiteSkill";
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
  const modelOptions = getSiteModelOptions();
  const { model } = modelOptions;
  const result = await generateObject({
    ...modelOptions,
    output: "object",
    schema: schema as z.ZodType<Record<string, unknown>>,
    maxRetries: 0,
    system: `${system}\n\n${loadSiteSkill().skill}\n${loadSiteSkill().principles}\n${loadSiteSkill().buildAndReview}`,
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
