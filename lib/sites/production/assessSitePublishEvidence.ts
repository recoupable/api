import { z } from "zod";
import { experienceContractSchema } from "./experienceContract";
import { getSitePublishIdentity, type SitePublishCandidate } from "./getSitePublishIdentity";
import { hashSiteEvidence } from "./hashSiteEvidence";
import { prepareSiteRenderArtifacts } from "./prepareSiteRenderArtifacts";
import { reviewSchema } from "./schema";
import { openingReviewSchema } from "./openingReviewSchema";

import { sitePublishEvidenceSchema } from "./sitePublishEvidenceSchema";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const verificationSchema = z.object({
  scope: z.literal("generated-experience"),
  humanApproval: z.literal("not-recorded"),
  nativeShareDelivery: z.literal("not-tested"),
  spotifyAuthentication: z.literal("not-tested"),
  journey: experienceContractSchema,
  evidence: z.object({ sourceSha256: hash, journeySha256: hash, runnerSha256: hash }),
  viewports: z
    .array(
      z.object({
        name: z.enum(["mobile", "desktop"]),
        journeyPassed: z.literal(true),
        errors: z.array(z.string()).length(0),
        overflow: z.literal(false),
      }),
    )
    .length(2),
  opening: openingReviewSchema
    .extend({ verdict: z.literal("pass"), issues: z.array(z.unknown()).length(0) })
    .optional(),
});
/** UNWIRED evidence assessment, not publication authorization.
 * Adapters MUST read authoritative persisted records, authorize the authenticated account
 * using authorizeSiteWorkspace, and resolve the actual draft/signed working-build candidate.
 * Never implement these adapters with request-body records. The server, not the request,
 * owns actor identity, record timestamps, candidate bindings and explicit override capture.
 * A future publisher still needs its existing access checks and atomic publication fence.
 */
export async function assessSitePublishEvidence(
  request: { siteId: string; revision: number; evidenceId: string },
  server: {
    accountId: string;
    readCandidate: (input: { siteId: string; accountId: string }) => Promise<SitePublishCandidate>;
    readEvidence: (input: {
      evidenceId: string;
      siteId: string;
      ownerId: string;
    }) => Promise<unknown>;
    now: () => number;
  },
) {
  const unsatisfied = (reason: string) => ({ status: "unsatisfied" as const, reason });
  if (!server.accountId) return unsatisfied("authentication-required");
  const current = structuredClone(
    await server.readCandidate({
      siteId: request.siteId,
      accountId: server.accountId,
    }),
  );
  if (
    current.siteId !== request.siteId ||
    current.revision !== request.revision ||
    !Number.isSafeInteger(request.revision) ||
    request.revision < 0
  )
    return unsatisfied("revision-mismatch");
  if (!current.candidate.design.experience) return unsatisfied("missing-experience");
  const identity = getSitePublishIdentity(current);
  const parsed = sitePublishEvidenceSchema.safeParse(
    await server.readEvidence({
      evidenceId: request.evidenceId,
      siteId: current.siteId,
      ownerId: current.ownerId,
    }),
  );
  if (!parsed.success) return unsatisfied("missing-or-invalid-record");
  const record = parsed.data;
  if (
    record.id !== request.evidenceId ||
    Object.entries(identity).some(([key, value]) => record[key as keyof typeof identity] !== value)
  )
    return unsatisfied("candidate-mismatch");
  const now = server.now();
  if (!Number.isSafeInteger(now) || now < 0 || Date.parse(record.recordedAt) > now)
    return unsatisfied("invalid-record-time");
  if (record.kind === "override") {
    if (record.recordedByAccountId !== server.accountId)
      return unsatisfied("override-actor-mismatch");
  } else {
    if (record.review === undefined || hashSiteEvidence(record.review) !== record.reviewSha256)
      return unsatisfied("report-mismatch");
    const review = reviewSchema
      .extend({ blocked: z.never().optional(), verification: verificationSchema })
      .safeParse(record.review);
    if (
      !review.success ||
      review.data.verdict !== "pass" ||
      review.data.issues.some(
        issue => issue.severity === "blocking" || issue.module === "direction",
      )
    )
      return unsatisfied("report-not-passed");
    const verification = review.data.verification;
    if (new Set(verification.viewports.map(viewport => viewport.name)).size !== 2)
      return unsatisfied("missing-viewport");
    const artifacts = prepareSiteRenderArtifacts(current.candidate, verification.journey);
    if (
      Object.entries(artifacts.evidence).some(
        ([key, value]) => verification.evidence[key as keyof typeof artifacts.evidence] !== value,
      )
    )
      return unsatisfied("artifact-mismatch");
  }
  return {
    status: "satisfied" as const,
    basis: record.kind,
    evidenceId: record.id,
    ...identity,
    recordedByAccountId: record.recordedByAccountId,
    recordedAt: record.recordedAt,
    humanApproval: "not-recorded" as const,
  };
}
