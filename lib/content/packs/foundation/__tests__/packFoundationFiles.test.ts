import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { bindPackFoundationFiles } from "../bindPackFoundationFiles";
import { createPackFoundationPlan } from "../createPackFoundationPlan";
import { foundationFixture } from "./foundationFixture";
it("hashes actual retained bytes and asset identity, never a temporary URL", async () => {
  const snapshot = foundationFixture();
  const asset = snapshot.assets.find(a => a.kind === "artwork")!;
  Object.assign(asset, {
    status: "completed",
    attempt: 1,
    caption: "Artwork",
    qa: { passed: true },
    files: [
      {
        storage_key: "owner/release-packs/art.png",
        content_type: "image/png",
        bytes: 3,
        url: "https://example.com/temporary",
      },
    ],
  });
  const plan = createPackFoundationPlan(snapshot, { dependentAssetIds: ["video-0"] });
  const read = vi.fn().mockResolvedValue(Buffer.from("art"));
  const bound = await bindPackFoundationFiles(plan, asset, read);
  expect(bound.state).toBe("ready");
  expect(bound.files[0].sha256).toBe(createHash("sha256").update("art").digest("hex"));
  expect(JSON.stringify(bound)).not.toContain("temporary");
  asset.files[0].url = "https://example.com/refreshed";
  expect(await bindPackFoundationFiles(plan, asset, read)).toEqual(bound);
  read.mockResolvedValue(Buffer.from("new"));
  expect((await bindPackFoundationFiles(plan, asset, read)).asset_sha256).not.toBe(
    bound.asset_sha256,
  );
});
it("does not read missing, failed or unreviewed foundations", async () => {
  const snapshot = foundationFixture();
  const plan = createPackFoundationPlan(snapshot, { dependentAssetIds: [] });
  const read = vi.fn();
  expect((await bindPackFoundationFiles(plan, undefined, read)).state).toBe("unavailable");
  expect((await bindPackFoundationFiles(plan, snapshot.assets[1], read)).state).toBe("unavailable");
  expect(read).not.toHaveBeenCalled();
});
it("rejects foreign paths and changed byte length", async () => {
  const snapshot = foundationFixture();
  const asset = snapshot.assets.find(a => a.kind === "artwork")!;
  Object.assign(asset, {
    status: "completed",
    caption: "Art",
    qa: { passed: true },
    files: [{ storage_key: "foreign/art.png", content_type: "image/png", bytes: 3 }],
  });
  const plan = createPackFoundationPlan(snapshot, { dependentAssetIds: [] });
  const read = vi.fn().mockResolvedValue(Buffer.from("art"));
  await expect(bindPackFoundationFiles(plan, asset, read)).rejects.toThrow("ownership");
  expect(read).not.toHaveBeenCalled();
  asset.files[0].storage_key = "owner/release-packs/art.png";
  asset.files[0].bytes = 4;
  await expect(bindPackFoundationFiles(plan, asset, read)).rejects.toThrow("length");
});
it("binds accepted receipt identity while tolerating JSONB key order", async () => {
  const snapshot = foundationFixture();
  const asset = snapshot.assets.find(a => a.kind === "artwork")!;
  Object.assign(asset, {
    status: "completed",
    attempt: 1,
    caption: "Artwork",
    qa: { passed: true },
    provider_state: { image_submission_0: { state: "complete", request_id: "one" } },
    files: [{ storage_key: "owner/release-packs/art.png", content_type: "image/png", bytes: 3 }],
  });
  const plan = createPackFoundationPlan(snapshot, { dependentAssetIds: [] });
  const first = await bindPackFoundationFiles(plan, asset, async () => Buffer.from("art"));
  asset.provider_state = { image_submission_0: { request_id: "one", state: "complete" } };
  expect(
    (await bindPackFoundationFiles(plan, asset, async () => Buffer.from("art"))).asset_sha256,
  ).toBe(first.asset_sha256);
  asset.provider_state = { image_submission_0: { request_id: "two", state: "complete" } };
  expect(
    (await bindPackFoundationFiles(plan, asset, async () => Buffer.from("art"))).asset_sha256,
  ).not.toBe(first.asset_sha256);
});
