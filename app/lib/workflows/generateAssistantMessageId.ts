import { generateId } from "ai";

/**
 * Vercel Workflow `"use step"` that returns a fresh message id.
 *
 * Wrapped as a step rather than inlined into the workflow body
 * because `generateId()` is non-deterministic — calling it directly
 * from workflow code would break the durable-replay contract (a
 * replay would generate a *different* id and diverge from the
 * captured event log). As a step, the result is captured in the
 * event log once and reused on every replay.
 *
 * Mirrors open-agents' `generateId` step in
 * `apps/web/app/workflows/chat.ts`.
 */
export async function generateAssistantMessageId(): Promise<string> {
  "use step";
  return generateId();
}
