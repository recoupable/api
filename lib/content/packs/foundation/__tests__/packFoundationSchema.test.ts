import { expect, it } from "vitest";
import { packFoundationRecordSchema } from "../packFoundationSchema";
import { createPackFoundationPlan } from "../createPackFoundationPlan";
import { foundationFixture } from "./foundationFixture";
it("never accepts a ready record without an asset identity and retained files", () => {
  const plan = createPackFoundationPlan(foundationFixture(), { dependentAssetIds: [] });
  expect(packFoundationRecordSchema.safeParse({ plan, state: "ready", files: [] }).success).toBe(
    false,
  );
  expect(
    packFoundationRecordSchema.safeParse({ plan, state: "none_requested", files: [] }).success,
  ).toBe(false);
});
