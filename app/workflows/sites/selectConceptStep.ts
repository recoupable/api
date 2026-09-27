import { selectExperienceConcept } from "@/lib/sites/production/selectExperienceConcept";
import { FatalError } from "workflow";
export async function selectConceptStep(...args: Parameters<typeof selectExperienceConcept>) {
  "use step";
  try {
    return await selectExperienceConcept(...args);
  } catch (error) {
    console.error(
      "[sites:selectConceptStep]",
      error instanceof Error ? error.message.slice(0, 1200) : "Unknown failure",
    );
    throw new FatalError(
      "No supported concept could be selected. No automatic provider retry was attempted.",
    );
  }
}
