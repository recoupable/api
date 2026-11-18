import { z } from "zod";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { insertSitePublishEvidence } from "@/lib/supabase/site_publish_evidence/insertSitePublishEvidence";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import { SiteError } from "../SiteError";
import type { Site } from "../schema";
import { getSitePublishIdentity } from "./getSitePublishIdentity";
import { hashSiteEvidence } from "./hashSiteEvidence";
import { serializeSiteEvidence } from "./serializeSiteEvidence";
import { prepareSiteRenderArtifacts } from "./prepareSiteRenderArtifacts";
import { experienceContractSchema } from "./experienceContract";
import { sitePublishEvidenceSchema } from "./sitePublishEvidenceSchema";

/** UNWIRED. savedSite MUST be the trusted final save return, never request-body state.
 * Retains failed reports; does not authorize publication or capture an implicit override.
 */
export async function captureSavedSiteReview(input: {
  accountId: string;
  savedSite: Site;
  operationKey: string;
}) {
  if (!input.accountId) throw new SiteError(401, "Authentication required");
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(input.operationKey))
    throw new SiteError(400, "Invalid evidence operation key");
  const saved = structuredClone(input.savedSite);
  const current = await selectSite(saved.id);
  if (!current) throw new SiteError(404, "Site not found");
  await authorizeSiteWorkspace(input.accountId, current.owner_id);
  if (
    current.id !== saved.id ||
    current.owner_id !== saved.owner_id ||
    current.revision !== saved.revision ||
    !Number.isSafeInteger(saved.revision) ||
    saved.revision < 0 ||
    serializeSiteEvidence(current.draft) !== serializeSiteEvidence(saved.draft)
  )
    throw new SiteError(409, "Saved site no longer matches the current draft");
  const candidate = saved.draft;
  const review = candidate?.production?.reviews.at(-1);
  if (!candidate?.design.experience || !review || typeof review !== "object")
    throw new SiteError(409, "Final saved review unavailable");
  const verification = review.verification;
  if (verification?.journey && verification.evidence) {
    // JSONB does not preserve object-key order. Match assessment's schema order
    // for execution bytes, while retaining the original report unchanged.
    const journey = experienceContractSchema.safeParse(verification.journey);
    if (!journey.success) throw new SiteError(409, "Saved report journey is invalid");
    const actual = prepareSiteRenderArtifacts(candidate, journey.data).evidence;
    if (
      Object.entries(actual).some(
        ([key, value]) => verification.evidence![key as keyof typeof actual] !== value,
      )
    )
      throw new SiteError(409, "Saved report execution artifacts do not match");
  } else if (review.verdict === "pass") {
    throw new SiteError(409, "Passed report is missing execution evidence");
  }
  const identity = getSitePublishIdentity({
    siteId: saved.id,
    ownerId: saved.owner_id,
    revision: saved.revision,
    candidate,
  });
  const raw = await insertSitePublishEvidence({
    ...identity,
    accountId: input.accountId,
    operationKey: input.operationKey,
    candidate,
    review,
  });
  const parsed = sitePublishEvidenceSchema.safeParse(raw);
  if (!parsed.success) throw new SiteError(503, "Invalid stored evidence response");
  const record = parsed.data;
  if (
    !z.uuid().safeParse(record.id).success ||
    record.kind !== "review" ||
    Object.entries(identity).some(
      ([key, value]) => record[key as keyof typeof identity] !== value,
    ) ||
    record.recordedByAccountId !== input.accountId ||
    Date.parse(record.recordedAt) > Date.now() ||
    record.reviewSha256 !== hashSiteEvidence(review) ||
    serializeSiteEvidence(record.review) !== serializeSiteEvidence(review)
  )
    throw new SiteError(503, "Stored evidence does not match capture");
  return record;
}
