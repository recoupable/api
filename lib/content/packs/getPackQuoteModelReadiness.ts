import { getPackModelReadiness } from "./getPackModelReadiness";
import { getPackPlannedModelTasks } from "./getPackPlannedModelTasks";
import type { ReleasePackBrief } from "./releasePackSchema";
import type { PackAssetPlan } from "./buildReleasePackQuote";
import type { getPackExecutionConfiguration } from "./getPackExecutionConfiguration";
/** Validate saved full-pack choices before any retry narrows the execution assessment. */
export function getPackQuoteModelReadiness(
  brief: ReleasePackBrief,
  assets: PackAssetPlan[],
  models: ReturnType<typeof getPackExecutionConfiguration>["models"],
) {
  for (const [task, requested] of Object.entries(brief.model_choices ?? {})) {
    const selected = models[task as keyof NonNullable<ReleasePackBrief["model_choices"]>];
    if (requested !== selected)
      throw new Error(
        `Unsupported ${task} model choice ${requested}; configured route is ${selected}. No substitution was made.`,
      );
  }
  const plannedTasks = getPackPlannedModelTasks(brief, assets);
  for (const task of Object.keys(brief.model_choices ?? {})) {
    if (!plannedTasks.includes(task as (typeof plannedTasks)[number]))
      throw new Error(
        `Model choice ${task} does not apply to this pack plan; no substitution was made.`,
      );
  }
  return getPackModelReadiness(plannedTasks);
}
