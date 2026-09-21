import { reviseProduction } from "@/lib/sites/production/reviseProduction";
import { FatalError } from "workflow";
export async function reviseStep(...args: Parameters<typeof reviseProduction>) {
  "use step";
  try {
    return await reviseProduction(...args);
  } catch (error) {
    console.error(
      "[sites:reviseStep]",
      error instanceof Error
        ? { name: error.name, message: error.message.slice(0, 1200) }
        : "Unknown failure",
    );
    throw new FatalError("Site revision failed. No automatic provider retry was attempted.");
  }
}
