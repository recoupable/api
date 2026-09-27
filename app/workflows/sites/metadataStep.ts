import { prepareSiteContext } from "@/lib/sites/production/prepareSiteContext";
import { FatalError } from "workflow";
export async function metadataStep(...args: Parameters<typeof prepareSiteContext>) {
  "use step";
  try {
    return await prepareSiteContext(...args);
  } catch (error) {
    console.error(
      "[sites:metadataStep]",
      error instanceof Error ? error.message.slice(0, 1200) : "Unknown failure",
    );
    throw new FatalError(
      "Site context metadataStep failed. No automatic provider retry was attempted.",
    );
  }
}
