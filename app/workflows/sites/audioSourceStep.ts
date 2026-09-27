import { acquireSiteContextAudio } from "@/lib/sites/production/acquireSiteContextAudio";
import { FatalError } from "workflow";
export async function audioSourceStep(...args: Parameters<typeof acquireSiteContextAudio>) {
  "use step";
  try {
    return await acquireSiteContextAudio(...args);
  } catch (error) {
    console.error(
      "[sites:audioSourceStep]",
      error instanceof Error ? error.message.slice(0, 1200) : "Unknown failure",
    );
    throw new FatalError(
      "Site context audioSourceStep failed. No automatic provider retry was attempted.",
    );
  }
}
