import { selectSitePublishEvidence } from "@/lib/supabase/site_publish_evidence/selectSitePublishEvidence";
import { insertSiteOverrideEvidence } from "@/lib/supabase/site_publish_evidence/insertSiteOverrideEvidence";
import { publishSiteEvidenceCandidate } from "@/lib/supabase/site_publish_evidence/publishSiteEvidenceCandidate";
import { SiteError } from "../../SiteError";
import { assessSitePublishEvidence } from "../assessSitePublishEvidence";
import { sitePublishEvidenceSchema } from "../sitePublishEvidenceSchema";
import { selectedSitePublicationSchema } from "./selectedSitePublicationSchema";
import { resolveSelectedSiteCandidate } from "./resolveSelectedSiteCandidate";
import { authorizeSelectedSitePublication } from "./authorizeSelectedSitePublication";
import { validateSiteOverrideReceipt } from "./validateSiteOverrideReceipt";
import { validateSitePublicationReceipt } from "./validateSitePublicationReceipt";

/** UNWIRED. Server identity/key are trusted context, not fields in raw input.
 * External authority checks are repeated but are not atomic with the proposed SQL fence.
 */
export async function publishSelectedSiteEvidence(
  server: { accountId: string; operationKey: string },
  raw: unknown,
) {
  if (!server.accountId) throw new SiteError(401, "Authentication required");
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(server.operationKey))
    throw new SiteError(400, "Invalid server operation key");
  const input = selectedSitePublicationSchema.parse(raw);
  const { selection } = input;
  let resolved = await resolveSelectedSiteCandidate(server.accountId, selection);
  await authorizeSelectedSitePublication(server.accountId, resolved, input.returnUrl);
  let evidenceId: string;
  if (input.evidence.kind === "override") {
    const captured = await insertSiteOverrideEvidence({
      ...resolved.identity,
      accountId: server.accountId,
      operationKey: server.operationKey,
      candidate: resolved.candidate,
      intent: input.evidence.intent,
      reason: input.evidence.reason,
    });
    evidenceId = validateSiteOverrideReceipt(
      captured,
      server.accountId,
      resolved.identity,
      input.evidence.reason,
    ).id;
  } else evidenceId = input.evidence.evidenceId;
  const assess = async () => {
    const parsedRecord = sitePublishEvidenceSchema.safeParse(
      await selectSitePublishEvidence({
        accountId: server.accountId,
        ownerId: selection.ownerId,
        siteId: selection.siteId,
        evidenceId,
      }),
    );
    if (!parsedRecord.success) throw new SiteError(503, "Stored evidence unavailable or invalid");
    const record = parsedRecord.data;
    if (record.kind !== input.evidence.kind)
      throw new SiteError(409, "Evidence kind does not match selected intent");
    if (input.evidence.kind === "override")
      validateSiteOverrideReceipt(
        record,
        server.accountId,
        resolved.identity,
        input.evidence.reason,
      );
    const assessment = await assessSitePublishEvidence(
      { siteId: selection.siteId, revision: selection.revision, evidenceId },
      {
        accountId: server.accountId,
        readCandidate: async () => ({ ...resolved.identity, candidate: resolved.candidate }),
        readEvidence: async () => record,
        now: Date.now,
      },
    );
    if (assessment.status !== "satisfied")
      throw new SiteError(409, "Selected evidence is not eligible: " + assessment.reason);
    return record;
  };
  await assess();
  resolved = await resolveSelectedSiteCandidate(server.accountId, selection);
  await authorizeSelectedSitePublication(server.accountId, resolved, input.returnUrl);
  const record = await assess();
  const result = await publishSiteEvidenceCandidate({
    accountId: server.accountId,
    ownerId: selection.ownerId,
    siteId: selection.siteId,
    revision: selection.revision,
    evidenceId,
    candidateSha256: selection.candidateSha256,
    expectedPublishedEvidenceId: selection.expectedPublishedEvidenceId,
    expectedArtistId: selection.artistId,
  });
  return validateSitePublicationReceipt(result, selection, record);
}
