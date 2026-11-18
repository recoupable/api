import type { ProjectionObservation, ProjectionProof } from "./projectionSchemas";
/** Fixed legacy-compatible expansion; identities never come from random values. */
export function projectionEvents(
  observation: ProjectionObservation,
): ProjectionProof["observations"][number]["events"] {
  const id = `${observation.id}:fallback`;
  return [
    observation,
    { type: "text-start", id },
    { type: "text-delta", id, delta: observation.data.fallback.text },
    { type: "text-end", id },
  ];
}
