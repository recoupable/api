import { createHash } from "node:crypto";

export interface ContextReuseInput {
  ownerId: string;
  subjectId: string;
  topic: string;
  recipeVersion: string;
  schemaVersion: string;
  requiredCoverage: string;
  instructionVersion?: string;
  sources: { id: string; version: string }[];
}

/** Fingerprint compatible analysis inputs; private derivations never cross owners. */
export function createContextReuseKey(input: ContextReuseInput): string {
  const sources = input.sources.map(source => [source.id, source.version]);
  sources.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const identity = [
    "context-reuse-v1",
    input.ownerId,
    input.subjectId,
    input.topic,
    input.recipeVersion,
    input.schemaVersion,
    input.requiredCoverage,
    input.instructionVersion ?? null,
    sources,
  ];
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}
