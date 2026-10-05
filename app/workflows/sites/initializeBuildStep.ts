import { SiteError } from "@/lib/sites/SiteError";
import { FatalError } from "workflow";
import { initializeSiteBuild } from "@/lib/sites/builder/initializeSiteBuild";
import { prepareBuildInput } from "@/lib/sites/production/prepareBuildInput";
import { getGenerationFailure } from "@/lib/sites/getGenerationFailure";
export async function initializeBuildStep(...args: Parameters<typeof prepareBuildInput>) {
  "use step";
  try {
    const input = prepareBuildInput(...args);
    const review = args[6];
    const existingWorld =
      review && review.issues.every(issue => issue.module === "implementation")
        ? args[5]?.brandWorld
        : undefined;
    return await initializeSiteBuild(input.site, input.instruction, args[4], existingWorld);
  } catch (error) {
    console.error("[sites:initialize]", getGenerationFailure(error));
    if (error instanceof SiteError && error.status >= 400 && error.status < 500)
      throw new FatalError(`Site build initialization blocked (${error.status}).`);
    // Ordinary step errors receive Workflow retries; do not turn transient failures fatal.
    throw error;
  }
}
