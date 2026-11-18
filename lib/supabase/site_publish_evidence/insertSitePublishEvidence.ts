import { callSiteEvidenceRpc } from "./callSiteEvidenceRpc";
import { buildSiteEvidenceRecordArgs } from "./buildSiteEvidenceRecordArgs";
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
  return callSiteEvidenceRpc("record_evidence", {
    ...buildSiteEvidenceRecordArgs(input),
    p_decision: {
      kind: "review",
      review: input.review,
      reviewSha256: hashSiteEvidence(input.review),
    },
    p_review_canonical: serializeSiteEvidence(input.review),
  });
}
