import { analyzeSiteContextAudio } from "@/lib/sites/production/analyzeSiteContextAudio";
import { FatalError } from "workflow";
export async function audioAnalysisStep(...args: Parameters<typeof analyzeSiteContextAudio>) {
  "use step";
  try {
    return await analyzeSiteContextAudio(...args);
  } catch (error) {
    console.error(
      "[sites:audioAnalysisStep]",
      error instanceof Error ? error.message.slice(0, 1200) : "Unknown failure",
    );
    throw new FatalError(
      "Site context audioAnalysisStep failed. No automatic provider retry was attempted.",
    );
  }
}
