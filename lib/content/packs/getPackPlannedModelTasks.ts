import { resolvePackCreativeContext } from "./resolvePackCreativeContext";
import type { ReleasePackBrief } from "./releasePackSchema";
import type { PackAssetPlan } from "./buildReleasePackQuote";
import type { PackModelTask } from "./getPackModelEvidence";
/** Provider tasks for this plan. Local composition never requires a model grant. */
export function getPackPlannedModelTasks(
  brief: ReleasePackBrief,
  assets: Pick<PackAssetPlan, "kind">[],
  needsAudioAnalysis = true,
): PackModelTask[] {
  if (!assets.length) return [];
  const tasks: PackModelTask[] = needsAudioAnalysis ? ["analysis"] : [];
  tasks.push(
    resolvePackCreativeContext(brief).reference_image_urls.length ? "image_edit" : "image",
    "caption",
  );
  if (assets.some(asset => asset.kind === "video")) tasks.push("motion");
  if (assets.some(asset => asset.kind !== "video" && asset.kind !== "visualizer"))
    tasks.push("still_inspection");
  if (assets.some(asset => asset.kind === "video" || asset.kind === "visualizer"))
    tasks.push("video_inspection");
  return tasks;
}
