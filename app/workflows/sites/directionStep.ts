import { directExperience } from "@/lib/sites/production/directExperience";
import { FatalError } from "workflow";
export async function directionStep(...args: Parameters<typeof directExperience>) {
  "use step";
  try {
    return await directExperience(...args);
  } catch (error) {
    console.error(
      "[sites:directionStep]",
      error instanceof Error
        ? { name: error.name, message: error.message.slice(0, 1200) }
        : "Unknown failure",
    );
    throw new FatalError(
      "Site production directionStep failed. No automatic provider retry was attempted.",
    );
  }
}
