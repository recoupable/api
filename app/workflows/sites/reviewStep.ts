import { reviewExperience } from "@/lib/sites/production/reviewExperience";
import { FatalError } from "workflow";
export async function reviewStep(...args: Parameters<typeof reviewExperience>) {
  "use step";
  try {
    return await reviewExperience(...args);
  } catch (error) {
    console.error(
      "[sites:reviewStep]",
      error instanceof Error
        ? { name: error.name, message: error.message.slice(0, 1200) }
        : "Unknown failure",
    );
    throw new FatalError(
      "Site production reviewStep failed. No automatic provider retry was attempted.",
    );
  }
}
