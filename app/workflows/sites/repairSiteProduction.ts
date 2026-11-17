import { readRepairCheckpointStep } from "./readRepairCheckpointStep";
import { reviseStep } from "./reviseStep";
import { reviewStep } from "./reviewStep";
import { revealBuildStep } from "./revealBuildStep";
import type { Site, SiteAsset, SiteSnapshot } from "@/lib/sites/schema";
import type {
  ReleaseContext,
  CreativeDirection,
  CreativeReview,
} from "@/lib/sites/production/schema";

/** Workflow orchestration only: all clock/control reads and effects are journaled steps. */
export async function repairSiteProduction(
  site: Site,
  instruction: string,
  context: ReleaseContext,
  direction: CreativeDirection,
  assets: SiteAsset[],
  snapshot: SiteSnapshot,
  firstReview: CreativeReview,
  accountId: string,
) {
  const reviews = [firstReview];
  let checkpoint = await readRepairCheckpointStep(site, accountId);
  const deadlineMs = checkpoint.now + 20 * 60 * 1000;
  let attempts = 0;
  const stop = () =>
    checkpoint.cancelled
      ? "site deleted"
      : checkpoint.revision !== site.revision
        ? "site revision changed"
        : checkpoint.now >= deadlineMs
          ? "repair time limit"
          : undefined;
  const failure = (reason: string) => ({
    error: `Site production stopped: ${reason}. Your saved draft and published version are unchanged.`,
  });
  while (true) {
    const reason = stop();
    if (reason) return failure(reason);
    const review = reviews.at(-1)!;
    if (review.blocked) return failure("credit limit");
    if (review.issues.some(issue => issue.module === "direction"))
      return { snapshot, direction, assets, reviews, status: "needs-review" as const };
    if (review.verdict === "pass" && !review.issues.some(issue => issue.severity === "blocking"))
      return { snapshot, direction, assets, reviews, status: "reviewed" as const };
    if (attempts >= 2) return failure("repair attempt limit");
    await revealBuildStep(direction.concept, assets, snapshot, review.issues[0]?.fix).catch(
      () => undefined,
    );
    // The reveal itself can consume time; admit work from a fresh durable checkpoint.
    checkpoint = await readRepairCheckpointStep(site, accountId);
    const beforeRepair = stop();
    if (beforeRepair) return failure(beforeRepair);
    attempts++;
    ({ snapshot, direction, assets } = await reviseStep(
      site,
      instruction,
      context,
      direction,
      assets,
      snapshot,
      review,
      accountId,
    ));
    await revealBuildStep(direction.concept, assets, snapshot).catch(() => undefined);
    checkpoint = await readRepairCheckpointStep(site, accountId);
    const beforeReview = stop();
    if (beforeReview) return failure(beforeReview);
    reviews.push(await reviewStep(snapshot, direction, accountId, site.id, context.siteSkill));
    checkpoint = await readRepairCheckpointStep(site, accountId);
  }
}
