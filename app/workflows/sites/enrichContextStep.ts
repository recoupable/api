import { enrichSiteContext } from "@/lib/sites/production/enrichSiteContext";
import { FatalError } from "workflow";
export async function enrichContextStep(...args: Parameters<typeof enrichSiteContext>) {
  "use step";
  try {
    return await enrichSiteContext(...args);
  } catch (error) {
    console.error(
      "[sites:enrichContextStep]",
      error instanceof Error ? error.message.slice(0, 1200) : "Unknown failure",
    );
    throw new FatalError(
      "Site context enrichContextStep failed. No automatic provider retry was attempted.",
    );
  }
}
