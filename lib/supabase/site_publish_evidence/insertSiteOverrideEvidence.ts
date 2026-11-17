import { callSiteEvidenceRpc } from "./callSiteEvidenceRpc";
import { buildSiteEvidenceRecordArgs } from "./buildSiteEvidenceRecordArgs";
import type { SiteSnapshot } from "@/lib/sites/schema";
/** UNWIRED: only explicit selected intent after server resolution/authorization. */
export async function insertSiteOverrideEvidence(input: {
  accountId: string;
  ownerId: string;
  siteId: string;
  revision: number;
  operationKey: string;
  candidate: SiteSnapshot;
  intent: "publish-without-passed-review";
  reason: string;
}) {
  return callSiteEvidenceRpc("record_evidence", {
    ...buildSiteEvidenceRecordArgs(input),
    p_decision: { kind: "override", intent: input.intent, reason: input.reason },
    p_review_canonical: null,
  });
}
