import type { SiteSnapshot } from "../schema";
/** Exclude only review history and derived status from the publication identity. */
export function getSitePublishContent(candidate: SiteSnapshot) {
  const content = structuredClone(candidate);
  if (content.production) {
    const { reviews: _reviews, status: _status, ...production } = content.production;
    return { ...content, production };
  }
  return content;
}
