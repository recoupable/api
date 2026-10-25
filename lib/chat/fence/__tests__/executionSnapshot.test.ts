import { expect, it } from "vitest";
import { buildChatExecutionSnapshot } from "../buildChatExecutionSnapshot";
import { verifyChatAdmissionSnapshot } from "../verifyChatAdmissionSnapshot";
import { snapshotFixture, workflowInput, policy, requestId, account } from "./snapshotFixture";
const scope = {
  chatId: workflowInput.chatId,
  sessionId: workflowInput.sessionId,
  effectiveAccountId: account,
  requestId,
  expectedEpoch: 0,
};
it("builds only explicit execution fields and excludes credentials", () => {
  const result = buildChatExecutionSnapshot({
    id: "snapshot-1",
    requestId,
    credentialPolicy: policy,
    workflowInput: {
      ...workflowInput,
      agentContext: {
        ...workflowInput.agentContext,
        recoupAccessToken: "DO-NOT-STORE",
        ephemeralKeyId: "runtime-key",
        sandbox: {
          ...workflowInput.agentContext.sandbox,
          state: { source: { repo: "https://github.com/example/repo", token: "GIT-SECRET" } },
        },
      },
    },
  });
  expect(result.canonical).not.toContain("DO-NOT-STORE");
  expect(result.canonical).not.toContain("GIT-SECRET");
  expect(result.canonical).not.toContain("runtime-key");
  expect(result.snapshot.content.credentialPolicy).toEqual(policy);
});
it("recovers the exact original snapshot without granting dispatch permission", () => {
  const { stored } = snapshotFixture();
  expect(verifyChatAdmissionSnapshot(scope, stored)).toEqual(stored);
});
it.each(["admission_canonical", "execution_canonical"] as const)(
  "rejects noncanonical or changed %s",
  field => {
    const { stored } = snapshotFixture();
    expect(() =>
      verifyChatAdmissionSnapshot(scope, { ...stored, [field]: stored[field] + " " }),
    ).toThrow();
  },
);
it.each(["chatId", "sessionId", "effectiveAccountId", "requestId", "expectedEpoch"] as const)(
  "rejects changed original scope %s",
  field => {
    const { stored } = snapshotFixture();
    expect(() =>
      verifyChatAdmissionSnapshot(
        { ...scope, [field]: field === "expectedEpoch" ? 2 : "different" },
        stored,
      ),
    ).toThrow();
  },
);
it("rejects missing material and changed projections or digests", () => {
  const { stored } = snapshotFixture();
  for (const altered of [
    null,
    {},
    { ...stored, receipt: { ...stored.receipt, input_hash: "a".repeat(64) } },
    { ...stored, execution_snapshot: { ...stored.execution_snapshot, id: "tampered" } },
    { ...stored, admission_envelope: { ...stored.admission_envelope, messages: [] } },
  ]) {
    expect(() => verifyChatAdmissionSnapshot(scope, altered)).toThrow();
  }
});
it("rejects different effective identity and unknown policy fields", () => {
  expect(() =>
    buildChatExecutionSnapshot({
      id: "snapshot",
      requestId,
      workflowInput,
      credentialPolicy: { ...policy, effectiveAccountId: requestId },
    }),
  ).toThrow();
  expect(() =>
    buildChatExecutionSnapshot({
      id: "snapshot",
      requestId,
      workflowInput,
      credentialPolicy: { ...policy, token: "secret" },
    }),
  ).toThrow();
});

it("retains the original closed resource without authorizing dispatch", () => {
  const { stored } = snapshotFixture();
  stored.receipt.closed = true;
  expect(verifyChatAdmissionSnapshot(scope, stored)).toEqual(stored);
});
it.each([
  "https://secret@github.com/example/repo",
  "https://github.com/example/repo?token=secret",
  "https://github.com/example/repo#secret",
])("rejects credential-bearing repository URL %s", repo => {
  expect(() =>
    buildChatExecutionSnapshot({
      id: "snapshot",
      requestId,
      credentialPolicy: policy,
      workflowInput: {
        ...workflowInput,
        agentContext: {
          ...workflowInput.agentContext,
          sandbox: { ...workflowInput.agentContext.sandbox, state: { source: { repo } } },
        },
      },
    }),
  ).toThrow();
});

it("preserves distinct repository routing and auth contexts without asserting resource authorization", () => {
  const result = buildChatExecutionSnapshot({
    id: "snapshot",
    requestId,
    credentialPolicy: policy,
    workflowInput: {
      ...workflowInput,
      agentContext: { ...workflowInput.agentContext, recoupOrgId: requestId },
    },
  });
  expect(result.snapshot.content.recoupOrgId).toBe(requestId);
  expect(result.snapshot.content.credentialPolicy.organizationId).toBeNull();
  // Structural/integrity acceptance is not a permission check. No dispatch capability is returned.
  expect(result).not.toHaveProperty("authorized");
});
it("rejects a bound original whose dispatch history says never attempted", () => {
  const { stored } = snapshotFixture();
  const bound = { ...stored, receipt: { ...stored.receipt, bound_run_id: "original-run" } };
  expect(() => verifyChatAdmissionSnapshot(scope, bound)).toThrow();
  expect(
    verifyChatAdmissionSnapshot(scope, {
      ...bound,
      dispatch: { status: "claimed", attempt_id: requestId },
    }).receipt.bound_run_id,
  ).toBe("original-run");
});
