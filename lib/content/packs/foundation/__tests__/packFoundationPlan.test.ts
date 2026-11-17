import { expect, it } from "vitest";
import { createPackFoundationPlan } from "../createPackFoundationPlan";
import { foundationFixture } from "./foundationFixture";
it("prefers explicitly selected existing quoted artwork; fallback is ordinal then id", () => {
  const snapshot = foundationFixture(2);
  snapshot.assets.reverse();
  expect(createPackFoundationPlan(snapshot, { dependentAssetIds: ["video-0"] }).asset_id).toBe(
    "artwork-0",
  );
  expect(
    createPackFoundationPlan(snapshot, {
      foundationAssetId: "artwork-1",
      dependentAssetIds: ["video-0"],
    }).asset_id,
  ).toBe("artwork-1");
});
it("records none requested without creating artwork or depending all assets", () => {
  const snapshot = foundationFixture(0);
  const plan = createPackFoundationPlan(snapshot, { dependentAssetIds: ["video-0"] });
  expect(plan.asset_id).toBeNull();
  expect(plan.selection).toBe("none_requested");
  expect(plan.dependent_asset_ids).toEqual(["video-0"]);
  expect(snapshot.assets).toHaveLength(2);
});
it("rejects unquoted, self-dependent and invalid selected assets", () => {
  const snapshot = foundationFixture();
  expect(() =>
    createPackFoundationPlan(snapshot, { foundationAssetId: "video-0", dependentAssetIds: [] }),
  ).toThrow();
  expect(() => createPackFoundationPlan(snapshot, { dependentAssetIds: ["artwork-0"] })).toThrow();
  expect(() => createPackFoundationPlan(snapshot, { dependentAssetIds: ["missing"] })).toThrow();
});
it("binds direction, revision and quote without depending on asset order", () => {
  const snapshot = foundationFixture();
  const input = { dependentAssetIds: ["video-0", "quote_card-0"] };
  const original = createPackFoundationPlan(snapshot, input);
  snapshot.assets.reverse();
  expect(createPackFoundationPlan(snapshot, input).digest).toBe(original.digest);
  snapshot.job.brief.creative_direction = "Red ink";
  expect(() => createPackFoundationPlan(snapshot, input)).toThrow("brief");
});
it("rejects stale brief approval and inconsistent no-artwork quotes", () => {
  const snapshot = foundationFixture();
  snapshot.job.brief.creative_direction = "Unapproved direction";
  expect(() => createPackFoundationPlan(snapshot, { dependentAssetIds: [] })).toThrow("brief");
  const other = foundationFixture();
  other.job.quote!.assets = other.job.quote!.assets.filter(a => a.kind !== "artwork");
  expect(() => createPackFoundationPlan(other, { dependentAssetIds: [] })).toThrow("artwork");
});
