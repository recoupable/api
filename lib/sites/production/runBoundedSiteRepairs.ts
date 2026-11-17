import { createHash } from "node:crypto";
import { z } from "zod";
import type { SiteSnapshot } from "../schema";
import type { CreativeReview } from "./schema";

const limitsSchema = z
  .object({
    maxAttempts: z.number().int().nonnegative().safe(),
    deadlineMs: z.number().int().positive().safe(),
  })
  .strict();
const controlSchema = z
  .object({ revision: z.number().int().nonnegative().safe(), cancelled: z.boolean() })
  .strict();
type StopReason =
  | "attempts-exhausted"
  | "time-exhausted"
  | "cancelled"
  | "revision-changed"
  | "review-blocked"
  | "direction-required";
type AttemptEvidence = { attempt: number; snapshotSha256: string; review: CreativeReview };
type Result = {
  baseRevision: number;
  attempts: number;
  candidate: SiteSnapshot;
  candidateSha256: string;
  history: AttemptEvidence[];
} & ({ status: "passed" } | { status: "stopped"; reason: StopReason });

/** Stage-bounded repair coordinator. Callers supply limits and authoritative control reads.
 * This helper owns no persistence, provider imports, or default policy.
 * Deadline checks gate stages; they cannot abort a callback already in flight.
 */
export async function runBoundedSiteRepairs(input: {
  snapshot: SiteSnapshot;
  review: CreativeReview;
  baseRevision: number;
  limits: unknown;
  repair: (candidate: SiteSnapshot, review: CreativeReview) => Promise<SiteSnapshot>;
  reviewCandidate: (candidate: SiteSnapshot) => Promise<CreativeReview>;
  readControl: () => Promise<{ revision: number; cancelled: boolean }>;
  now: () => number;
}): Promise<Result> {
  const limits = limitsSchema.parse(input.limits);
  const baseRevision = z.number().int().nonnegative().safe().parse(input.baseRevision);
  let candidate = structuredClone(input.snapshot);
  let review = structuredClone(input.review);
  let attempts = 0;
  let lastTime = 0;
  const history: AttemptEvidence[] = [];
  const candidateHash = () => createHash("sha256").update(JSON.stringify(candidate)).digest("hex");
  const record = () =>
    history.push({
      attempt: attempts,
      snapshotSha256: candidateHash(),
      review: structuredClone(review),
    });
  const result = (reason?: StopReason): Result => ({
    baseRevision,
    attempts,
    candidate,
    candidateSha256: candidateHash(),
    history,
    ...(reason ? { status: "stopped" as const, reason } : { status: "passed" as const }),
  });
  const checkpoint = async (): Promise<StopReason | undefined> => {
    const control = controlSchema.parse(await input.readControl());
    const now = z.number().int().nonnegative().safe().parse(input.now());
    if (now < lastTime) throw new Error("Repair clock moved backwards");
    lastTime = now;
    if (control.cancelled) return "cancelled";
    if (control.revision !== baseRevision) return "revision-changed";
    if (now >= limits.deadlineMs) return "time-exhausted";
  };
  record();
  while (true) {
    const stop = await checkpoint();
    if (stop) return result(stop);
    if (review.blocked) return result("review-blocked");
    if (review.issues.some(issue => issue.module === "direction"))
      return result("direction-required");
    if (review.verdict === "pass" && !review.issues.some(issue => issue.severity === "blocking"))
      return result();
    if (attempts >= limits.maxAttempts) return result("attempts-exhausted");
    attempts++;
    candidate = structuredClone(
      await input.repair(structuredClone(candidate), structuredClone(review)),
    );
    const afterRepair = await checkpoint();
    if (afterRepair) return result(afterRepair);
    review = structuredClone(await input.reviewCandidate(structuredClone(candidate)));
    record();
  }
}
