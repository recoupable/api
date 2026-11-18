import { z } from "zod";
export const streamProtocolSchema = z.enum(["canonical-base-v1", "unmarked-v1"]);
export type StreamProtocol = z.infer<typeof streamProtocolSchema>;
export const CONTINUATION_HEADER = "X-Recoup-Stream-Continuation";
export const CONTINUATION_WORKFLOW =
  "workflow//./app/lib/workflows/runAgentWorkflow.ts//runAgentWorkflow";
