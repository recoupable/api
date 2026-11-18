import { z } from "zod";
import { encodeStrictJson } from "@/lib/chat/fence/encodeStrictJson";
import {
  projectionObservationSchema,
  projectionProofSchema,
  projectionReceiptSchema,
} from "./projectionSchemas";
import { projectionEvents } from "./projectionEvents";
import { parseProjectionRunAuthority } from "./parseProjectionRunAuthority";
import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
import { readProjectionEvidence } from "./readProjectionEvidence";
import type {
  ProjectionAuthority,
  ProjectionEvidencePorts,
  ProjectionProducer,
} from "./ProjectionEvidencePorts";
const record = z.record(z.string(), z.unknown());
const json = (value: unknown, maxBytes = 1_048_576) => {
  try {
    return encodeStrictJson(value, { omitUndefinedObjectProperties: true, maxBytes });
  } catch (error) {
    throw new ProjectionEvidenceError(
      error instanceof Error && error.message === "JSON exceeds byte budget"
        ? "evidence_limit"
        : "invalid_evidence",
    );
  }
};
/** Source-only verifier: caller must establish current chat authority; no default admitted deployments. */
export async function verifyProjectionObservation(input: {
  observation: unknown;
  message: unknown;
  scope: ProjectionAuthority;
  producers: readonly ProjectionProducer[];
  ports: ProjectionEvidencePorts;
  signal: AbortSignal;
}) {
  let observation;
  try {
    json(input.observation);
    observation = projectionObservationSchema.parse(input.observation);
  } catch {
    throw new ProjectionEvidenceError("invalid_observation");
  }
  const { data } = observation;
  const expectedText =
    data.original.type === "custom"
      ? "This view cannot display additional model content."
      : "This view cannot display a reasoning attachment.";
  if (
    observation.id !== `${data.assistantMessageId}:projection:${data.ordinal}` ||
    data.fallback.text !== expectedText
  )
    throw new ProjectionEvidenceError("invalid_observation");
  const message = z
    .object({ id: z.string(), role: z.literal("assistant"), parts: z.array(z.unknown()) })
    .safeParse(input.message);
  const span = data.fallback.partIndex;
  if (
    !message.success ||
    message.data.id !== data.assistantMessageId ||
    json(message.data.parts[span - 1] ?? null) !== json(observation) ||
    json(message.data.parts[span] ?? null) !==
      json({ type: "text", text: expectedText, state: "done" })
  )
    throw new ProjectionEvidenceError("span_mismatch");
  if (!input.producers.length) throw new ProjectionEvidenceError("producer_mismatch");
  const deadline = AbortSignal.timeout(5000);
  const signal = AbortSignal.any([input.signal, deadline]);
  const read = async <T>(operation: () => Promise<T>) => {
    try {
      return await readProjectionEvidence(operation, signal);
    } catch (error) {
      if (deadline.aborted && !input.signal.aborted)
        throw new ProjectionEvidenceError("evidence_timeout");
      throw error;
    }
  };
  const rawRun = await read(() => input.ports.readRun(data.originRunId, signal));
  const run = record.safeParse(rawRun);
  if (!run.success) throw new ProjectionEvidenceError("invalid_evidence");
  const producer = input.producers.find(
    p => p.deploymentId === run.data.deploymentId && p.workflowName === run.data.workflowName,
  );
  if (!producer || run.data.runId !== data.originRunId)
    throw new ProjectionEvidenceError("producer_mismatch");
  if (
    run.data.expiredAt ||
    (Array.isArray(run.data.input) &&
      record.safeParse(run.data.input[0]).success &&
      "expiredAt" in run.data.input[0])
  )
    throw new ProjectionEvidenceError("evidence_expired");
  const authority = parseProjectionRunAuthority(run.data.input);
  if (
    authority.accountId !== input.scope.accountId ||
    authority.chatId !== input.scope.chatId ||
    authority.sessionId !== input.scope.sessionId
  )
    throw new ProjectionEvidenceError("authority_mismatch");
  const rawStep = await read(() =>
    input.ports.readStep(data.originRunId, data.originStepId, signal),
  );
  const step = record.safeParse(rawStep);
  if (!step.success) throw new ProjectionEvidenceError("invalid_evidence");
  if (
    step.data.runId !== data.originRunId ||
    step.data.stepId !== data.originStepId ||
    step.data.stepName !== producer.stepName
  )
    throw new ProjectionEvidenceError("producer_mismatch");
  if (step.data.status !== "completed") throw new ProjectionEvidenceError("proof_pending");
  const output = record.safeParse(step.data.output);
  if (output.success && output.data.generatedProjectionObservations !== undefined)
    json(output.data.generatedProjectionObservations, 16_777_216);
  const proof = projectionProofSchema.safeParse(
    output.success ? output.data.generatedProjectionObservations : undefined,
  );
  if (!proof.success) throw new ProjectionEvidenceError("proof_missing");
  const identities = new Set<string>();
  let previous = -1;
  for (const item of proof.data.observations) {
    const value = item.observation.data;
    if (
      value.originRunId !== data.originRunId ||
      value.originStepId !== data.originStepId ||
      value.assistantMessageId !== data.assistantMessageId ||
      value.ordinal <= previous ||
      identities.has(item.observation.id)
    )
      throw new ProjectionEvidenceError("invalid_evidence");
    previous = value.ordinal;
    identities.add(item.observation.id);
  }
  const rawReceipt = await read(() =>
    input.ports.readReceipt(data.originRunId, data.originStepId, producer.proofStepName, signal),
  );
  const receiptRecord = record.safeParse(rawReceipt);
  if (!receiptRecord.success) throw new ProjectionEvidenceError("proof_missing");
  if (
    receiptRecord.data.runId !== data.originRunId ||
    receiptRecord.data.stepName !== producer.proofStepName ||
    typeof receiptRecord.data.stepId !== "string" ||
    receiptRecord.data.stepId === data.originStepId
  )
    throw new ProjectionEvidenceError("producer_mismatch");
  if (receiptRecord.data.status !== "completed") throw new ProjectionEvidenceError("proof_pending");
  if (receiptRecord.data.output !== undefined) json(receiptRecord.data.output, 16_777_216);
  const receipt = projectionReceiptSchema.safeParse(receiptRecord.data.output);
  if (!receipt.success) throw new ProjectionEvidenceError("proof_missing");
  if (receipt.data.producerStepId !== data.originStepId)
    throw new ProjectionEvidenceError("producer_mismatch");
  if (
    json(receipt.data.generatedProjectionObservations, 16_777_216) !== json(proof.data, 16_777_216)
  )
    throw new ProjectionEvidenceError("proof_missing");
  const matches = proof.data.observations.filter(
    item => json(item.observation) === json(observation),
  );
  const expectedEvents = projectionEvents(observation);
  if (
    matches.length !== 1 ||
    json(matches[0].events, 16_777_216) !== json(expectedEvents, 16_777_216)
  )
    throw new ProjectionEvidenceError("proof_missing");
  const chunks = await read(() => input.ports.readCanonical(data.originRunId, signal));
  if (!Array.isArray(chunks) || chunks.length > 10000)
    throw new ProjectionEvidenceError("evidence_limit");
  try {
    encodeStrictJson(chunks, { omitUndefinedObjectProperties: true, maxBytes: 16_777_216 });
  } catch {
    throw new ProjectionEvidenceError("invalid_evidence");
  }
  let occurrences = 0;
  for (let index = 0; index <= chunks.length - expectedEvents.length; index++)
    if (
      json(chunks.slice(index, index + expectedEvents.length), 16_777_216) ===
      json(expectedEvents, 16_777_216)
    )
      occurrences++;
  if (
    occurrences !== 1 ||
    !chunks.some(chunk => {
      const value = record.safeParse(chunk);
      return (
        value.success &&
        value.data.type === "start" &&
        value.data.messageId === data.assistantMessageId
      );
    })
  )
    throw new ProjectionEvidenceError("canonical_mismatch");
  return data.original;
}
