import { getWorld } from "workflow/runtime";
import { observabilityRevivers } from "workflow/observability";
import { hydrateDataWithKey, isEncryptedData } from "@workflow/core/serialization-format";
import { importKey } from "@workflow/core/encryption";
import { verifyGenerationJob } from "./verifyGenerationJob";
import { SiteError } from "../SiteError";
import type { Site, SiteSnapshot } from "../schema";
import type { SiteBuildState } from "../builder/types";
import type { CreativeDirection, ReleaseContext } from "./schema";

/** Recover only a finished source snapshot from an authorized build, never caller-supplied code. */
export async function readPublishableBuild(
  token: string,
  site: Site,
  accountId: string,
): Promise<SiteSnapshot> {
  const { runId } = verifyGenerationJob(token, site.id, accountId);
  const world = getWorld();
  let cursor: string | undefined;
  do {
    const page = await world.steps.list({
      runId,
      resolveData: "none",
      pagination: { limit: 100, sortOrder: "desc", cursor },
    });
    for (const step of page.data) {
      if (step.status !== "completed" || step.stepName.split("//").at(-1) !== "buildTurnStep")
        continue;
      const resource = await world.steps.get(runId, step.stepId, { resolveData: "all" });
      let key;
      if (isEncryptedData(resource.output)) {
        const run = await world.runs.get(runId);
        const rawKey = await world.getEncryptionKeyForRun?.(run);
        if (!rawKey) throw new SiteError(503, "Saved build is temporarily unavailable. Try again.");
        key = await importKey(rawKey);
      }
      const state = (await hydrateDataWithKey(
        resource.output,
        observabilityRevivers,
        key,
      )) as SiteBuildState;
      if (
        state.site.id !== site.id ||
        state.site.owner_id !== site.owner_id ||
        state.site.revision !== site.revision
      )
        throw new SiteError(
          409,
          "This build is older than your current draft. Reload before publishing.",
        );
      if (!state.snapshot?.design.experience) continue;
      const { creativeContext } = JSON.parse(state.instruction) as {
        creativeContext: { release: ReleaseContext; direction: CreativeDirection };
      };
      return {
        ...state.snapshot,
        production: {
          version: 1,
          context: creativeContext.release,
          direction: creativeContext.direction,
          reviews: [],
          status: "needs-review",
        },
      };
    }
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
  throw new SiteError(
    400,
    "The first playable build is not ready yet. Publish once a working preview appears.",
  );
}
