import { createSandboxFromSnapshot } from "@/lib/sandbox/createSandboxFromSnapshot";
import type { SandboxCreatedResponse } from "@/lib/sandbox/createSandbox";

type ProcessCreateSandboxInput = {
  accountId: string;
};

/**
 * Shared domain logic for `POST /api/sandboxes`: create a sandbox (from the
 * account's snapshot if available, otherwise fresh) and shape the response.
 *
 * The OpenClaw `prompt` mode — which offloaded to the `run-sandbox-command`
 * Trigger.dev task via `triggerPromptSandbox` — has been retired
 * (recoupable/chat#1813). Async agent work now runs on the durable
 * `runAgentWorkflow` via `POST /api/chat/generate`; this endpoint only
 * provisions a bare sandbox.
 *
 * @param input - The sandbox creation parameters.
 * @returns The sandbox creation result.
 */
export async function processCreateSandbox(
  input: ProcessCreateSandboxInput,
): Promise<SandboxCreatedResponse> {
  const { accountId } = input;

  const { sandbox } = await createSandboxFromSnapshot(accountId);

  return {
    sandboxId: sandbox.name,
    sandboxStatus: sandbox.sdkStatus,
    timeout: sandbox.timeout,
    createdAt: sandbox.createdAt.toISOString(),
  };
}
