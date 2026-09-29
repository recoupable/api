import { advanceSiteBuild } from "@/lib/sites/builder/advanceSiteBuild";
import { FatalError } from "workflow";
export async function buildTurnStep(...args: Parameters<typeof advanceSiteBuild>) {
  "use step";
  try {
    return await advanceSiteBuild(...args);
  } catch (error) {
    console.error("[sites:build-turn-failed]", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    throw new FatalError(
      "Site build provider turn failed. No automatic provider retry was attempted.",
    );
  }
}
