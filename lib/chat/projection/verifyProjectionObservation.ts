import { z } from "zod";
import { isExpiredStub } from "@workflow/core/serialization-format";
import { encodeProjectionEvidence as json } from "./encodeProjectionEvidence";
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
  // SDK consumers disagree on future expiredAt values. Until the configured World
  // contract is qualified, refuse those values without asserting they are expired.
  if (run.data.expiredAt != null) {
    const value = run.data.expiredAt;
    const timestamp =
      value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN;
    if (!Number.isFinite(timestamp)) throw new ProjectionEvidenceError("invalid_evidence");
    throw new ProjectionEvidenceError(
      timestamp <= Date.now() ? "evidence_expired" : "evidence_unavailable",
    );
  }
  if (isExpiredStub(run.data.input)) throw new ProjectionEvidenceError("evidence_expired");
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
  json(chunks, 16_777_216);
  let occurrences = 0;
  let activeAssistant: unknown;
  const expected = json(expectedEvents, 16_777_216);
  for (let index = 0; index < chunks.length; index++) {
    const chunk = record.safeParse(chunks[index]);
    if (!chunk.success) throw new ProjectionEvidenceError("canonical_mismatch");
    if (chunk.data.type === "start") activeAssistant = chunk.data.messageId;
    if (chunk.data.type === "finish" || chunk.data.type === "abort" || chunk.data.type === "error")
      activeAssistant = undefined;
    if (json(chunks.slice(index, index + expectedEvents.length), 16_777_216) === expected) {
      if (activeAssistant !== data.assistantMessageId)
        throw new ProjectionEvidenceError("canonical_mismatch");
      occurrences++;
    }
  }
  if (occurrences !== 1) throw new ProjectionEvidenceError("canonical_mismatch");
  return data.original;
}
