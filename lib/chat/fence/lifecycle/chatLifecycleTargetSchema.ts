import { z } from "zod";
import { chatFenceAuthoritySchema, chatFenceWriterSchema } from "../chatFenceSchemas";
/** Captured original target, not a current-owner discovery request or authorization grant. */
export const chatLifecycleTargetSchema = z.discriminatedUnion("phase", [
  chatFenceAuthoritySchema.extend({ phase: z.literal("pending"), runId: z.null() }).strict(),
  chatFenceWriterSchema.extend({ phase: z.literal("running") }).strict(),
]);
export type ChatLifecycleTarget = Readonly<z.infer<typeof chatLifecycleTargetSchema>>;
export type RunningChatLifecycleTarget = Extract<ChatLifecycleTarget, { phase: "running" }>;
