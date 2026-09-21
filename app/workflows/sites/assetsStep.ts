import { produceAssets } from "@/lib/sites/production/produceAssets";
import { FatalError } from "workflow";
export async function assetsStep(...args: Parameters<typeof produceAssets>) {
  "use step";
  try {
    return await produceAssets(...args);
  } catch (error) {
    console.error(
      "[sites:assetsStep]",
      error instanceof Error
        ? { name: error.name, message: error.message.slice(0, 1200) }
        : "Unknown failure",
    );
    throw new FatalError(
      "Site production assetsStep failed. No automatic provider retry was attempted.",
    );
  }
}
