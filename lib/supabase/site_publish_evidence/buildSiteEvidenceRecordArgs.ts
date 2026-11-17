import { getSitePublishContent } from "@/lib/sites/production/getSitePublishContent";
import { hashSiteEvidence } from "@/lib/sites/production/hashSiteEvidence";
import { serializeSiteEvidence } from "@/lib/sites/production/serializeSiteEvidence";
import type { SiteSnapshot } from "@/lib/sites/schema";
/** One canonical candidate envelope shared by review and explicit-override capture. */
export function buildSiteEvidenceRecordArgs(input: {
  accountId: string;
  ownerId: string;
  siteId: string;
  revision: number;
  operationKey: string;
  candidate: SiteSnapshot;
}) {
  const content = getSitePublishContent(input.candidate);
  return {
    p_actor: input.accountId,
    p_owner: input.ownerId,
    p_site: input.siteId,
    p_revision: input.revision,
    p_key: input.operationKey,
    p_candidate: input.candidate,
    p_candidate_canonical: serializeSiteEvidence(content),
    p_candidate_sha: hashSiteEvidence(content),
  };
}
