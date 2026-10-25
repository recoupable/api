import { z } from "zod";
import { chatFenceAuthoritySchema } from "@/lib/chat/fence/chatFenceSchemas";
import type { RunAgentWorkflowInput } from "../runAgentWorkflow";

export const internalWorkflowFenceSchema = z
  .object({
    authority: chatFenceAuthoritySchema,
    attemptId: z.uuid(),
    turn: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("new") }).strict(),
      z.object({ kind: z.literal("same-turn-resume"), assistantId: z.string().min(1) }).strict(),
    ]),
  })
  .strict();
export type InternalWorkflowFence = z.infer<typeof internalWorkflowFenceSchema>;
/**
 * Internal-only invocation contract, never a public body or enrollment flag.
 * No route/MCP producer exists. A future producer must first prove resource
 * authorization, admission/dispatch and credential ownership; this type does
 * not constitute that proof or authorize recovery. No new secret fields.
 */
export type TrustedFencedWorkflowInput = {
  kind: "internal-fenced/v1";
  input: RunAgentWorkflowInput;
  fence: InternalWorkflowFence;
};
