import { encodeStrictJson } from "@/lib/chat/fence/encodeStrictJson";
import { projectionObservationSchema, type ProjectionProof } from "./projectionSchemas";
import { projectionEvents } from "./projectionEvents";
import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
/**
 * Fresh native events only. The caller must never supply history/seed parts here.
 * Accepted public writes are NOT storage ACKs. This candidate is usable only after
 * independent completed-step and canonical-stream readback by the verifier.
 */
export async function writeProjectionObservation(
  input: {
    originRunId: string;
    originStepId: string;
    assistantMessageId: string;
    ordinal: number;
    partIndex: number;
    original: unknown;
  },
  write: (chunk: unknown) => Promise<void>,
): Promise<ProjectionProof["observations"][number]> {
  let observation;
  try {
    const original = JSON.parse(
      encodeStrictJson(input.original, {
        omitUndefinedObjectProperties: true,
        maxBytes: 1_048_576,
      }),
    );
    observation = projectionObservationSchema.parse({
      type: "data-recoup-sdk-observation",
      id: `${input.assistantMessageId}:projection:${input.ordinal}`,
      data: {
        version: 1,
        originRunId: input.originRunId,
        originStepId: input.originStepId,
        assistantMessageId: input.assistantMessageId,
        ordinal: input.ordinal,
        original,
        fallback: {
          partIndex: input.partIndex,
          text:
            original.type === "custom"
              ? "This view cannot display additional model content."
              : "This view cannot display a reasoning attachment.",
        },
      },
    });
    encodeStrictJson(observation, { omitUndefinedObjectProperties: true, maxBytes: 1_048_576 });
  } catch {
    throw new ProjectionEvidenceError("invalid_observation");
  }
  const events = projectionEvents(observation);
  for (const event of events) await write(event);
  return { observation, events, canonicalWrite: "requires-readback" };
}
