import { saveSiteContextBrief } from "@/lib/sites/production/saveSiteContextBrief";
import { FatalError } from "workflow";
export async function contextBriefStep(...args: Parameters<typeof saveSiteContextBrief>) {
  "use step";
  try {
    return await saveSiteContextBrief(...args);
  } catch (error) {
    console.error(
      "[sites:contextBriefStep]",
      error instanceof Error ? error.message.slice(0, 1200) : "Unknown failure",
    );
    throw new FatalError(
      "Site context contextBriefStep failed. No automatic provider retry was attempted.",
    );
  }
}
