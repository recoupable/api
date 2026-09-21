import { collectReleaseContext } from "@/lib/sites/production/collectReleaseContext";
import { FatalError } from "workflow";
export async function collectContextStep(...args: Parameters<typeof collectReleaseContext>) {
  "use step";
  try {
    return await collectReleaseContext(...args);
  } catch (error) {
    console.error(
      "[sites:collectContextStep]",
      error instanceof Error
        ? { name: error.name, message: error.message.slice(0, 1200) }
        : "Unknown failure",
    );
    throw new FatalError(
      "Site production collectContextStep failed. No automatic provider retry was attempted.",
    );
  }
}
