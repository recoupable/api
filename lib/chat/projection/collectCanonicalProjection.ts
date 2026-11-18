import type { UIMessage, UIMessageChunk } from "ai";
import { encodeProjectionEvidence } from "./encodeProjectionEvidence";
import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
import { writeProjectionObservation } from "./writeProjectionObservation";
import type { ProjectionProof } from "./projectionSchemas";
/** Consume only fresh SDK emissions. Seeded canonical parts are never added to the proof collection. */
export async function collectCanonicalProjection(input: {
  stream: AsyncIterable<UIMessageChunk>;
  previous: UIMessage;
  runId: string;
  stepId: () => string;
  onProjection: () => void;
  isCancellation?: (error: unknown) => Promise<boolean>;
  write: (chunk: UIMessageChunk) => Promise<void>;
}) {
  const chunks: UIMessageChunk[] = [];
  const proof: ProjectionProof = { contract: "recoup-sdk-projection/v1", observations: [] };
  let partCount = input.previous.parts.length;
  let ordinal = 0;
  const tools = new Set<string>();
  const dataIds = new Set<string>();
  for (const part of input.previous.parts) {
    if ("toolCallId" in part) tools.add(`${part.type === "dynamic-tool"}:${part.toolCallId}`);
    if (part.type.startsWith("data-") && "id" in part && part.id != null)
      dataIds.add(`${part.type}:${part.id}`);
    if (part.type === "data-recoup-sdk-observation") {
      const previousOrdinal = (part.data as { ordinal: number }).ordinal;
      if (!Number.isSafeInteger(previousOrdinal))
        throw new ProjectionEvidenceError("invalid_observation");
      ordinal = Math.max(ordinal, previousOrdinal + 1);
    }
  }
  let bytes = 2;
  const append = async (chunk: UIMessageChunk) => {
    bytes += Buffer.byteLength(encodeProjectionEvidence(chunk, 16_777_216), "utf8") + 1;
    if (bytes > 16_777_216 || chunks.length >= 10000)
      throw new ProjectionEvidenceError("evidence_limit");
    chunks.push(chunk);
    try {
      await input.write(chunk);
    } catch {
      // Even an early unknown append outcome must not replay the provider step.
      throw new ProjectionEvidenceError("evidence_unavailable");
    }
  };
  let cancelled = false;
  try {
    for await (const chunk of input.stream) {
      if (chunk.type === "custom" || chunk.type === "reasoning-file") {
        input.onProjection();
        if (proof.observations.length >= 256) throw new ProjectionEvidenceError("evidence_limit");
        const candidate = await writeProjectionObservation(
          {
            originRunId: input.runId,
            originStepId: input.stepId(),
            assistantMessageId: input.previous.id,
            ordinal: ordinal++,
            partIndex: partCount + 1,
            original: chunk,
          },
          event => append(event as UIMessageChunk),
        );
        proof.observations.push(candidate);
        encodeProjectionEvidence(proof, 16_777_216);
        partCount += 2;
        continue;
      }
      if (
        [
          "data-recoup-sdk-observation",
          "tool-approval-request",
          "tool-approval-response",
          "error",
        ].includes(chunk.type)
      )
        throw new ProjectionEvidenceError("invalid_observation");
      // These are the installed SDK's append/upsert rules, only for span indexing.
      // Final assembly below uses the actual SDK and independently checks every span.
      if (
        [
          "text-start",
          "reasoning-start",
          "file",
          "source-url",
          "source-document",
          "start-step",
        ].includes(chunk.type)
      )
        partCount++;
      else if (
        ["tool-input-start", "tool-input-available", "tool-input-error"].includes(chunk.type)
      ) {
        const tool = chunk as { toolCallId: string; dynamic?: boolean };
        const key = `${!!tool.dynamic}:${tool.toolCallId}`;
        if (!tools.has(key)) {
          tools.add(key);
          partCount++;
        }
      } else if (chunk.type.startsWith("data-")) {
        const data = chunk as { id?: string; transient?: boolean };
        const key = `${chunk.type}:${data.id}`;
        if (!data.transient && (data.id == null || !dataIds.has(key))) {
          partCount++;
          if (data.id != null) dataIds.add(key);
        }
      }
      await append(chunk);
    }
  } catch (error) {
    if (error instanceof ProjectionEvidenceError || !(await input.isCancellation?.(error)))
      throw error;
    // Assemble only the canonical prefix already accepted by the writer. The workflow
    // still requires proof/readback and message ACK before the existing Stop charge.
    cancelled = true;
  }
  const { readUIMessageStream } = await import("ai");
  let message = structuredClone(input.previous);
  try {
    for await (const current of readUIMessageStream({
      message,
      terminateOnError: true,
      stream: new ReadableStream<UIMessageChunk>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      }),
    }))
      message = current;
  } catch {
    throw new ProjectionEvidenceError("canonical_mismatch");
  }
  for (const item of proof.observations) {
    const { observation } = item;
    const index = observation.data.fallback.partIndex;
    if (
      encodeProjectionEvidence(message.parts[index - 1]) !==
        encodeProjectionEvidence(observation) ||
      encodeProjectionEvidence(message.parts[index]) !==
        encodeProjectionEvidence({
          type: "text",
          text: observation.data.fallback.text,
          state: "done",
        })
    )
      throw new ProjectionEvidenceError("canonical_mismatch");
  }
  return { message, generatedProjectionObservations: proof, cancelled };
}
