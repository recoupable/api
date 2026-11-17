import { callSiteEvidenceRpc } from "./callSiteEvidenceRpc";
import { getSitePublishContent } from "@/lib/sites/production/getSitePublishContent";
import { hashSiteEvidence } from "@/lib/sites/production/hashSiteEvidence";
import { serializeSiteEvidence } from "@/lib/sites/production/serializeSiteEvidence";
import type { SiteSnapshot } from "@/lib/sites/schema";
/** Capture only server-resolved review inputs. SQL owns create-once identity and time. */
export async function insertSitePublishEvidence(input: {
  accountId: string;
  ownerId: string;
  siteId: string;
  revision: number;
  operationKey: string;
  candidate: SiteSnapshot;
  review: unknown;
}) {
  const content = getSitePublishContent(input.candidate);
  return callSiteEvidenceRpc("record_evidence", {
    p_actor: input.accountId,
    p_owner: input.ownerId,
    p_site: input.siteId,
    p_revision: input.revision,
    p_key: input.operationKey,
    p_candidate: input.candidate,
    p_candidate_canonical: serializeSiteEvidence(content),
    p_candidate_sha: hashSiteEvidence(content),
    p_decision: {
      kind: "review",
      review: input.review,
      reviewSha256: hashSiteEvidence(input.review),
    },
    p_review_canonical: serializeSiteEvidence(input.review),
  });
}
