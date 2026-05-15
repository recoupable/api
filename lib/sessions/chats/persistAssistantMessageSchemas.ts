import { z } from "zod";

export const assistantUiMessageSchema = z
  .object({
    id: z.string().min(1),
    role: z.literal("assistant"),
    parts: z.array(z.unknown()),
  })
  .passthrough();

export const persistAssistantMessageBodySchema = z
  .object({
    message: assistantUiMessageSchema,
  })
  .strict();
