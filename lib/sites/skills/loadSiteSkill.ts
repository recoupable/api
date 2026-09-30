import bundle from "./bundle.json";
/** Deployment-pinned guidance; arbitrary paths and remote skill URLs are never accepted. */
export function loadSiteSkill(referenceIds: number[] = []) {
  const references = [...new Set(referenceIds)].map(id => {
    const reference = bundle.references.find(item => item.id === id);
    if (!reference) throw new Error(`Unknown site reference: ${id}`);
    return reference;
  });
  return { ...bundle, references };
}
