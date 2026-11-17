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

it("enforces reasons and complete dependent binding coverage", () => {
  const plan = createPackFoundationPlan(foundationFixture(), { dependentAssetIds: ["video-0"] });
  const parse = (value: object) =>
    packFoundationRecordSchema.safeParse({ plan, files: [], ...value }).success;
  expect(parse({ state: "pending", reason: "failed" })).toBe(false);
  expect(parse({ state: "unavailable" })).toBe(false);
  const ready = {
    state: "ready",
    asset_sha256: "a".repeat(64),
    files: [
      {
        storage_key: "owner/release-packs/art.png",
        content_type: "image/png",
        bytes: 1,
        sha256: "b".repeat(64),
      },
    ],
  };
  expect(parse(ready)).toBe(false);
  expect(parse({ ...ready, dependency_bindings: [{ asset_id: "video-0", attempt: 1 }] })).toBe(
    true,
  );
  expect(
    parse({
      ...ready,
      plan: { ...plan, asset_id: null },
      dependency_bindings: [{ asset_id: "video-0", attempt: 1 }],
    }),
  ).toBe(false);
  const none = createPackFoundationPlan(foundationFixture(0), { dependentAssetIds: [] });
  expect(parse({ plan: none, state: "none_requested" })).toBe(true);
});
