import { buildChatExecutionSnapshot } from "../buildChatExecutionSnapshot";
import { canonicalizeChatAdmission } from "../canonicalizeChatAdmission";
export const account = "11111111-1111-4111-8111-111111111111";
export const requestId = "22222222-2222-4222-8222-222222222222";
export const workflowInput = {
  messages: [
    { id: "user-1", role: "user" as const, parts: [{ type: "text" as const, text: "hello" }] },
  ],
  chatId: "chat",
  sessionId: "session",
  accountId: account,
  modelId: "synthetic-model",
  agentContext: {
    sandbox: { state: { sandboxName: "synthetic-sandbox" }, workingDirectory: "/workspace" },
    skills: [],
  },
};
export const policy = {
  policyVersion: "chat-credential/v1" as const,
  credentialIntentId: "33333333-3333-4333-8333-333333333333",
  principal: {
    mechanism: "recoup_api_key" as const,
    accountId: account,
    keyId: "44444444-4444-4444-8444-444444444444",
  },
  effectiveAccountId: account,
  organizationId: null,
  authorization: { version: "synthetic/v1", basis: "self", permissions: ["chat:execute"] },
  recovery: "reauthenticate_proven_never_dispatched" as const,
};
export function snapshotFixture() {
  const execution = buildChatExecutionSnapshot({
    id: "snapshot-1",
    requestId,
    workflowInput,
    credentialPolicy: policy,
  });
  const admission = canonicalizeChatAdmission({
    contractVersion: "chat-admission/v1",
    effectiveAccountId: account,
    chatId: workflowInput.chatId,
    sessionId: workflowInput.sessionId,
    expectedEpoch: 0,
    messages: workflowInput.messages,
    options: { modelId: workflowInput.modelId },
    executionSnapshot: { id: execution.snapshot.id, digest: execution.digest },
  });
  const payload = {
    request_id: requestId,
    expected_epoch: 0,
    input_hash: admission.inputHash,
    admission_envelope: admission.envelope,
    execution_snapshot: execution.snapshot,
    admission_canonical: admission.canonical,
    execution_canonical: execution.canonical,
  };
  const receipt = {
    chat_id: workflowInput.chatId,
    request_id: requestId,
    expected_epoch: 0,
    epoch: 1,
    input_hash: admission.inputHash,
    bound_run_id: null,
    closed: false,
  };
  return {
    execution,
    admission,
    payload,
    receipt,
    stored: {
      dispatch: { status: "never_attempted" as const, attempt_id: null },
      receipt,
      admission_envelope: admission.envelope,
      execution_snapshot: execution.snapshot,
      admission_canonical: admission.canonical,
      execution_canonical: execution.canonical,
    },
  };
}
