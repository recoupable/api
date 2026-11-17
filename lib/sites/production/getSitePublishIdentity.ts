import { hashSiteEvidence } from "./hashSiteEvidence";
import type { SiteSnapshot } from "../schema";

export type SitePublishCandidate = {
  siteId: string;
  ownerId: string;
  revision: number;
  candidate: SiteSnapshot;
};
/** Bind publication content, excluding only review history and its derived status. */
export function getSitePublishIdentity({ candidate, ...identity }: SitePublishCandidate) {
  const content = structuredClone(candidate);
  if (content.production) {
    const { reviews: _reviews, status: _status, ...production } = content.production;
    return { ...identity, candidateSha256: hashSiteEvidence({ ...content, production }) };
  }
  return { ...identity, candidateSha256: hashSiteEvidence(content) };
}
