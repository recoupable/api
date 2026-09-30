import bundle from "./bundle.json";
/** Only deployment-pinned chapters and examples are available to the reference agent. */
export function loadVisualGuidance(topic: string, referenceIds: number[]) {
  const visual = bundle.visualExperience;
  if (!Object.hasOwn(visual.topics, topic)) throw new Error(`Unknown visual topic: ${topic}`);
  const references = [...new Set(referenceIds)].map(id => {
    const reference = visual.examples.find(item => item.id === id);
    if (!reference) throw new Error(`Unknown visual reference: ${id}`);
    return reference;
  });
  return {
    name: visual.name,
    sourceHash: visual.sourceHash,
    topic,
    guidance: visual.topics[topic as keyof typeof visual.topics],
    references,
  };
}
