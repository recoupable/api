import { initializeSiteBuild } from "@/lib/sites/builder/initializeSiteBuild";
import { prepareBuildInput } from "@/lib/sites/production/prepareBuildInput";
import { FatalError } from "workflow";
export async function initializeBuildStep(...args: Parameters<typeof prepareBuildInput>) {
  "use step";
  try {
    const input = prepareBuildInput(...args);
    return await initializeSiteBuild(input.site, input.instruction, args[4]);
  } catch {
    throw new FatalError("Site build initialization failed.");
  }
}
