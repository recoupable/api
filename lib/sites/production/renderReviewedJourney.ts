import type { SiteSnapshot } from "../schema";
import type { ExperienceContract } from "./experienceContract";
import { compileJourney } from "./compileJourney";
import { renderExperience } from "./renderExperience";

/** Correct a failed generated test once before asking the site builder to change working code. */
export async function renderReviewedJourney(
  snapshot: SiteSnapshot,
  contract: ExperienceContract,
  accountId: string,
  siteId: string,
) {
  let journey = await compileJourney(snapshot, contract, accountId, siteId);
  let rendered = await renderExperience(snapshot, journey);
  if (rendered.report.some(report => !report.journeyPassed)) {
    journey = await compileJourney(snapshot, contract, accountId, siteId, {
      journey,
      reports: rendered.report,
    });
    rendered = await renderExperience(snapshot, journey);
  }
  return { journey, rendered };
}
