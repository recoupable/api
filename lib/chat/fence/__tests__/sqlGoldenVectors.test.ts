import { verifyChatAdmissionSnapshot } from "../verifyChatAdmissionSnapshot";
import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildChatExecutionSnapshot } from "../buildChatExecutionSnapshot";
import { canonicalizeChatAdmission } from "../canonicalizeChatAdmission";
import { policy, requestId, workflowInput } from "./snapshotFixture";
it("matches the API-generated UTF8 vectors shared with the pinned SQL harness", () => {
  const values = [
    { name: "floats", data: [0.1, 1e-7, 1.2345678901234567, -0, 0.000001] },
    { name: "numeric-keys", data: { "2": "two", "10": "ten", "1": "one" } },
    { name: "utf16-key-order", data: { "\ue000": "BMP", "😀": "non-BMP" } },
    { name: "normalization", data: { composed: "é", decomposed: "e\u0301", pair: "😀" } },
  ];
  const vectors = values.map(({ name, data }) => {
    const input = { ...workflowInput, chatId: `golden-${name}`, sessionId: `session-${name}` };
    const execution = buildChatExecutionSnapshot({
      id: `snapshot-${name}`,
      requestId,
      workflowInput: input,
      credentialPolicy: policy,
    });
    const admission = canonicalizeChatAdmission({
      contractVersion: "chat-admission/v1",
      effectiveAccountId: input.accountId,
      chatId: input.chatId,
      sessionId: input.sessionId,
      expectedEpoch: 0,
      messages: [{ id: "u1", role: "user", parts: [{ type: "data-synthetic", data }] }],
      options: { modelId: input.modelId },
      executionSnapshot: { id: execution.snapshot.id, digest: execution.digest },
    });
    return {
      name,
      payload: {
        request_id: requestId,
        expected_epoch: 0,
        input_hash: admission.inputHash,
        admission_envelope: admission.envelope,
        execution_snapshot: execution.snapshot,
        admission_canonical: admission.canonical,
        execution_canonical: execution.canonical,
      },
    };
  });
  if (process.env.CHAT_FENCE_GOLDEN_OUTPUT)
    writeFileSync(process.env.CHAT_FENCE_GOLDEN_OUTPUT, JSON.stringify(vectors, null, 2) + "\n");
  expect(JSON.parse(JSON.stringify(vectors))).toEqual(
    JSON.parse(readFileSync("scripts/chat-fence-fixture/golden-vectors.json", "utf8")),
  );
  expect(vectors[0].payload.admission_canonical).toContain(
    "[0.1,1e-7,1.2345678901234567,0,0.000001]",
  );
  expect(vectors[1].payload.admission_canonical).toContain('{"1":"one","10":"ten","2":"two"}');
  expect(vectors[2].payload.admission_canonical).toContain('{"😀":"non-BMP","":"BMP"}');
});

it.runIf(Boolean(process.env.CHAT_FENCE_SQL_RESULT))(
  "verifies actual PostgreSQL retrieval bytes including closed originals",
  () => {
    const results = JSON.parse(readFileSync(process.env.CHAT_FENCE_SQL_RESULT!, "utf8"));
    expect(results).toHaveLength(8);
    for (const { stored } of results) {
      const a = stored.admission_envelope;
      const scope = {
        chatId: a.chatId,
        sessionId: a.sessionId,
        effectiveAccountId: a.effectiveAccountId,
        requestId: stored.receipt.request_id,
        expectedEpoch: stored.receipt.expected_epoch,
      };
      expect(verifyChatAdmissionSnapshot(scope, stored)).toEqual(stored);
      expect(() =>
        verifyChatAdmissionSnapshot(scope, {
          ...stored,
          execution_canonical: stored.execution_canonical + " ",
        }),
      ).toThrow();
    }
  },
);
