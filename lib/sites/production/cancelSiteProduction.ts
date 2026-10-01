import { getRun } from "workflow/api";
import { verifyGenerationJob } from "./verifyGenerationJob";
/** Signed browser job handles can cancel only this account's build for this site. */
export async function cancelSiteProduction(token: string, siteId: string, accountId: string) {
  const job = verifyGenerationJob(token, siteId, accountId);
  const run = getRun(job.runId);
  if (!["completed", "failed", "cancelled"].includes(await run.status)) await run.cancel();
}
