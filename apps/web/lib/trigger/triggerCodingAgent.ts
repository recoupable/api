import { tasks } from "@trigger.dev/sdk";

type CodingAgentPayload = {
  prompt: string;
  callbackThreadId: string;
};

/**
 * Triggers the coding-agent task to spin up a sandbox, clone the monorepo,
 * run the AI agent, and create PRs for any changes.
 *
 * @param payload - The task payload with prompt and callback thread ID
 * @returns The task handle with runId
 */
export async function triggerCodingAgent(payload: CodingAgentPayload) {
  const handle = await tasks.trigger("coding-agent", payload);
  return handle;
}
