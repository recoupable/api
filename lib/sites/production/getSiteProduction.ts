import { readSiteBuildProgress } from "./readSiteBuildProgress";
import { getRun } from "workflow/api";
import { verifyGenerationJob } from "./verifyGenerationJob";
import type { Site } from "../schema";
export async function getSiteProduction(token: string, siteId: string, accountId: string) {
  const job = verifyGenerationJob(token, siteId, accountId);
  const run = getRun<{ site: Site } | { error: string }>(job.runId);
  const status = await run.status;
  const progress = await readSiteBuildProgress(job.runId).catch(() => undefined);
  const evidence = progress ? { progress } : {};
  if (status === "completed") {
    const result = await run.returnValue;
    if ("error" in result)
      return { generation: { status: "failed" as const, ...evidence }, error: result.error };
    return { generation: { status: "completed" as const }, ...result };
  }
  if (status === "failed" || status === "cancelled")
    return {
      generation: { status: "failed" as const, ...evidence },
      error:
        "Production stopped. Your saved draft is unchanged. Check generation logs before retrying.",
    };
  // Progress is supplementary: an observability outage must not stop a healthy build.
  return { generation: { status: "running" as const, ...(progress ? { progress } : {}) } };
}
