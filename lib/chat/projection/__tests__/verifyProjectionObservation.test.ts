import { describe, expect, it, vi } from "vitest";
import { verifyProjectionObservation } from "../verifyProjectionObservation";

const scope = { accountId: "account", chatId: "chat", sessionId: "session" };
const producer = {
  deploymentId: "deployment",
  workflowName: "workflow//chat//run",
  stepName: "step//chat//runAgentStep",
  proofStepName: "step//chat//recordProjectionProofStep",
};
const baseObservation = {
  type: "data-recoup-sdk-observation",
  id: "assistant:projection:0",
  data: {
    version: 1,
    originRunId: "run",
    originStepId: "step",
    assistantMessageId: "assistant",
    ordinal: 0,
    original: {
      type: "custom",
      kind: "provider.kind",
      providerMetadata: { provider: { opaque: ["retained", 1] } },
    },
    fallback: {
      partIndex: 1,
      text: "This view cannot display additional model content.",
    },
  },
};
const baseEvents = [
  baseObservation,
  { type: "text-start", id: "assistant:projection:0:fallback" },
  {
    type: "text-delta",
    id: "assistant:projection:0:fallback",
    delta: baseObservation.data.fallback.text,
  },
  { type: "text-end", id: "assistant:projection:0:fallback" },
];
function fixture() {
  const observation = structuredClone(baseObservation);
  const events = structuredClone(baseEvents);
  const run = {
    runId: "run",
    ...producer,
    input: [{ ...scope, modelId: "model", messages: [], agentContext: {} }],
  };
  const step = {
    runId: "run",
    stepId: "step",
    stepName: producer.stepName,
    status: "completed",
    output: {
      generatedProjectionObservations: {
        contract: "recoup-sdk-projection/v1",
        observations: [{ observation, events, canonicalWrite: "requires-readback" }],
      },
    },
  };
  const receipt = {
    runId: "run",
    stepId: "proof-step",
    stepName: producer.proofStepName,
    status: "completed",
    output: {
      contract: "recoup-sdk-projection-proof/v1",
      producerStepId: "step",
      generatedProjectionObservations: step.output.generatedProjectionObservations,
    },
  };
  const ports = {
    readRun: vi.fn(async () => run),
    readStep: vi.fn(async () => step),
    readReceipt: vi.fn(async () => receipt),
    readCanonical: vi.fn(async () => [{ type: "start", messageId: "assistant" }, ...events]),
  };
  const input = {
    observation,
    message: {
      id: "assistant",
      role: "assistant",
      parts: [observation, { type: "text", text: observation.data.fallback.text, state: "done" }],
    },
    scope,
    producers: [producer],
    ports,
    signal: new AbortController().signal,
  };
  return { run, step, receipt, ports, input };
}
describe("journal-backed projection verification", () => {
  it("requires exact fresh proof and canonical pair under server authority", async () => {
    const { input } = fixture();
    expect(await verifyProjectionObservation(input)).toEqual(baseObservation.data.original);
  });
  it.each(["accountId", "chatId", "sessionId"] as const)(
    "rejects wrong recorded %s",
    async field => {
      const { input, run, ports } = fixture();
      run.input[0][field] = "other";
      await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
        code: "authority_mismatch",
      });
      expect(ports.readStep).not.toHaveBeenCalled();
    },
  );
  it.each(["workflowName", "deploymentId"] as const)("rejects unapproved %s", async field => {
    const { input, run } = fixture();
    run[field] = "other";
    await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
      code: "producer_mismatch",
    });
  });
  it("fails closed with no configured trusted producer", async () => {
    const { input, ports } = fixture();
    input.producers = [];
    await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
      code: "producer_mismatch",
    });
    expect(ports.readRun).not.toHaveBeenCalled();
  });
  it("never accepts an aggregate response seed as generated proof", async () => {
    const { input, step } = fixture();
    Object.assign(step.output, { responseMessage: input.message });
    delete (step.output as Record<string, unknown>).generatedProjectionObservations;
    await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
      code: "proof_missing",
    });
  });
  it.each(["runId", "stepId", "stepName"] as const)(
    "rejects wrong recorded step %s",
    async field => {
      const { input, step } = fixture();
      step[field] = "other";
      await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
        code: "producer_mismatch",
      });
    },
  );
  it("rejects an incomplete step even with a matching aggregate", async () => {
    const { input, step } = fixture();
    step.status = "running";
    await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
      code: "proof_pending",
    });
  });
  it("requires actual stored stream equality even when a completed step result matches", async () => {
    const { input, ports } = fixture();
    ports.readCanonical.mockResolvedValue([{ type: "start", messageId: "assistant" }]);
    await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
      code: "canonical_mismatch",
    });
  });
  it("does not promote partial fallback text", async () => {
    const { input } = fixture();
    input.message.parts[1] = { type: "text", text: "Additional", state: "done" };
    await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
      code: "span_mismatch",
    });
  });
  it("does not restore from a different assistant", async () => {
    const { input } = fixture();
    input.message.id = "other";
    await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
      code: "span_mismatch",
    });
  });
  it("rejects expired input without trusting any row", async () => {
    const { input, run } = fixture();
    (run as Record<string, unknown>).input = [{ expiredAt: "2026-01-01" }];
    await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
      code: "evidence_expired",
    });
  });
  it("preserves distinct unavailable evidence failures", async () => {
    const { input, ports } = fixture();
    ports.readRun.mockRejectedValue(new Error("private transport details"));
    await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
      code: "evidence_unavailable",
      message: "Projection history evidence unavailable",
    });
  });
  it("rejects invalid original semantics such as approvals", async () => {
    const { input } = fixture();
    (input.observation.data as Record<string, unknown>).original = {
      type: "tool-approval-response",
      approved: true,
    };
    await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
      code: "invalid_observation",
    });
  });
  it("bounds an uncooperative metadata read and observes cancellation", async () => {
    const { input, ports } = fixture();
    const controller = new AbortController();
    input.signal = controller.signal;
    ports.readRun.mockImplementation(() => new Promise(() => {}));
    const pending = verifyProjectionObservation(input);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
  });
});
it("rejects duplicate completed proof entries instead of selecting one", async () => {
  const { input, step } = fixture();
  step.output.generatedProjectionObservations.observations.push(
    structuredClone(step.output.generatedProjectionObservations.observations[0]),
  );
  await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
    code: "invalid_evidence",
  });
});
it("requires an approved identity even when caller namespace/version looks valid", async () => {
  const { input, run } = fixture();
  (run as Record<string, unknown>).deploymentId = undefined;
  await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
    code: "producer_mismatch",
  });
});
it("rejects a second copy in the stream as ambiguous rather than reusing an index", async () => {
  const { input, ports } = fixture();
  ports.readCanonical.mockResolvedValue([
    { type: "start", messageId: "assistant" },
    ...baseEvents,
    ...baseEvents,
  ]);
  await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
    code: "canonical_mismatch",
  });
});
it("does not accept arbitrarily nested input authority", async () => {
  const { input, run } = fixture();
  (run as Record<string, unknown>).input = [{ unrelated: { ...scope } }];
  await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
    code: "invalid_evidence",
  });
});
it("rejects leftover encrypted or unresolved input bytes", async () => {
  const { input, run } = fixture();
  (run as Record<string, unknown>).input = new Uint8Array([1, 2]);
  await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
    code: "invalid_evidence",
  });
});
it("requires a separate completed receipt with present output", async () => {
  const { input, receipt } = fixture();
  delete (receipt as Record<string, unknown>).output;
  await expect(verifyProjectionObservation(input)).rejects.toMatchObject({ code: "proof_missing" });
});
it("does not substitute the producer step for the distinct proof step", async () => {
  const { input, receipt } = fixture();
  receipt.stepId = "step";
  await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
    code: "producer_mismatch",
  });
});
it("checks the receipt producer linkage, not just identical observations", async () => {
  const { input, receipt } = fixture();
  receipt.output.producerStepId = "other-step";
  await expect(verifyProjectionObservation(input)).rejects.toMatchObject({
    code: "producer_mismatch",
  });
});
