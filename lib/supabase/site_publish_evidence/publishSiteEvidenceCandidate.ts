import { callSiteEvidenceRpc } from "./callSiteEvidenceRpc";
/** UNWIRED proposal: SQL publishes the immutable record candidate, never supplied bytes. */
export async function publishSiteEvidenceCandidate(input: {
  accountId: string;
  ownerId: string;
  siteId: string;
  revision: number;
  evidenceId: string;
  candidateSha256: string;
  expectedPublishedEvidenceId: string | null;
  expectedArtistId: string | null;
}) {
  return callSiteEvidenceRpc("publish_candidate", {
    p_actor: input.accountId,
    p_owner: input.ownerId,
    p_site: input.siteId,
    p_revision: input.revision,
    p_record: input.evidenceId,
    p_candidate_sha: input.candidateSha256,
    p_expected_pointer: input.expectedPublishedEvidenceId,
    p_expected_artist_id: input.expectedArtistId,
  });
}
