import { callSiteEvidenceRpc } from "./callSiteEvidenceRpc";
/** The returned record is evidence, never the authoritative candidate snapshot. */
export async function selectSitePublishEvidence(input: {
  accountId: string;
  ownerId: string;
  siteId: string;
  evidenceId: string;
}) {
  return callSiteEvidenceRpc("read_evidence", {
    p_actor: input.accountId,
    p_owner: input.ownerId,
    p_site: input.siteId,
    p_record: input.evidenceId,
  });
}
