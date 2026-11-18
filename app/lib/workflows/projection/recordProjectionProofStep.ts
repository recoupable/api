import { encodeProjectionEvidence } from "@/lib/chat/projection/encodeProjectionEvidence";
import { projectionReceiptSchema } from "@/lib/chat/projection/projectionSchemas";
import { ProjectionEvidenceError } from "@/lib/chat/projection/ProjectionEvidenceError";
/** Workflow must await the completed producer before this deterministic, effect-free step. */
export async function recordProjectionProofStep(producerStepId: string, observations: unknown) {
  "use step";

  try {
    const output = projectionReceiptSchema.parse(
      JSON.parse(
        encodeProjectionEvidence(
          {
            contract: "recoup-sdk-projection-proof/v1",
            producerStepId,
            generatedProjectionObservations: observations,
          },
          16_777_216,
        ),
      ),
    );
    for (const item of output.generatedProjectionObservations.observations)
      encodeProjectionEvidence(item.observation);
    if (
      output.generatedProjectionObservations.observations.some(
        item => item.observation.data.originStepId !== producerStepId,
      )
    )
      throw new Error("Mismatched producer");
    return output;
  } catch (error) {
    if (error instanceof ProjectionEvidenceError) throw error;
    throw new ProjectionEvidenceError("invalid_evidence");
  }
}
