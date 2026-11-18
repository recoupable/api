import { encodeStrictJson } from "@/lib/chat/fence/encodeStrictJson";
import { projectionReceiptSchema } from "@/lib/chat/projection/projectionSchemas";
import { ProjectionEvidenceError } from "@/lib/chat/projection/ProjectionEvidenceError";
/** Workflow must await the completed producer before this deterministic, effect-free step. */
export async function recordProjectionProofStep(producerStepId: string, observations: unknown) {
  "use step";

  try {
    const output = projectionReceiptSchema.parse(
      JSON.parse(
        encodeStrictJson(
          {
            contract: "recoup-sdk-projection-proof/v1",
            producerStepId,
            generatedProjectionObservations: observations,
          },
          { omitUndefinedObjectProperties: true, maxBytes: 16_777_216 },
        ),
      ),
    );
    if (
      output.generatedProjectionObservations.observations.some(
        item => item.observation.data.originStepId !== producerStepId,
      )
    )
      throw new Error("Mismatched producer");
    return output;
  } catch {
    throw new ProjectionEvidenceError("invalid_evidence");
  }
}
