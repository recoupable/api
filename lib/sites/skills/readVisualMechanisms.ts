import bundle from "./visualMechanisms.json";
import { visualMechanismSchema } from "./visualMechanismSchema";
/** Read only named, deployment-pinned resources; never execute reference code or fetch URLs. */
export function readVisualMechanisms(input: unknown) {
  const { patternIds = [], chapter, kernel } = visualMechanismSchema.parse(input);
  const patterns = [...new Set(patternIds)].map(id => {
    const pattern = bundle.patterns.find(item => item.id === id);
    if (!pattern) throw new Error(`Unknown visual mechanism: ${id}`);
    return pattern;
  });
  return {
    name: bundle.name,
    sourceHash: bundle.sourceHash,
    catalog: bundle.patterns.map(({ id, title, family }) => ({ id, title, family })),
    patterns,
    ...(chapter ? { guidance: bundle.chapters[chapter] } : {}),
    ...(kernel ? { kernel: bundle.kernels[kernel] } : {}),
  };
}
