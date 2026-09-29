import { expect, it } from "vitest";
import { resolveAssetPlan } from "../assets/resolveAssetPlan";
it("keeps the chosen model and rejects unsupported media combinations", () => {
  expect(
    resolveAssetPlan({
      model: "nano-banana-pro",
      rationale: "Preserve the character across assets",
    }).type,
  ).toBe("image");
  expect(
    resolveAssetPlan({ model: "seedance-2.5", rationale: "Cinematic atmosphere", duration: 5 })
      .type,
  ).toBe("video");
  expect(() => resolveAssetPlan({ model: "soul" })).toThrow();
  expect(() =>
    resolveAssetPlan({ model: "seedance-2.5", duration: 30, rationale: "long" }),
  ).toThrow();
});
it("migrates legacy plans to the current image candidate without using retired models", () => {
  expect(resolveAssetPlan(undefined)).toMatchObject({ model: "gpt-image-2", type: "image" });
});
