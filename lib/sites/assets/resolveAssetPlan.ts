import { assetModelCatalog, assetProductionSchema } from "./catalog";
export function resolveAssetPlan(value: unknown) {
  const plan = assetProductionSchema.parse(
    value ?? {
      model: "gpt-image-2",
      rationale: "Legacy image plan migrated to the current image candidate.",
    },
  );
  const candidate = assetModelCatalog.find(item => item.id === plan.model)!;
  return {
    ...candidate,
    ...plan,
    duration: plan.model === "seedance-2.5" ? (plan.duration ?? 5) : undefined,
  };
}
