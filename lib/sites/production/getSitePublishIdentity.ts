import { getSitePublishContent } from "./getSitePublishContent";
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
  return { ...identity, candidateSha256: hashSiteEvidence(getSitePublishContent(candidate)) };
}
