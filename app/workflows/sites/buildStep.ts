import { buildExperience } from "@/lib/sites/production/buildExperience";
import { FatalError } from "workflow";
export async function buildStep(...args: Parameters<typeof buildExperience>) {
  "use step";
  try {
    return await buildExperience(...args);
  } catch (error) {
    console.error(
      "[sites:buildStep]",
      error instanceof Error
        ? { name: error.name, message: error.message.slice(0, 1200) }
        : "Unknown failure",
    );
    throw new FatalError(
      "Site production buildStep failed. No automatic provider retry was attempted.",
    );
  }
}
