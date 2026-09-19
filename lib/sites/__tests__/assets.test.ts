import { beforeEach, expect, it, vi } from "vitest";
import { processSiteAsset } from "../processSiteAsset";
const m = vi.hoisted(() => ({ access: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: m.access,
}));
vi.mock("@/lib/supabase/storage/uploadSiteAsset", () => ({ uploadSiteAsset: m.upload }));
const account = "22222222-2222-4222-8222-222222222222",
  org = "33333333-3333-4333-8333-333333333333";
beforeEach(() => {
  vi.resetAllMocks();
  m.upload.mockResolvedValue("https://storage.test/file.mp3");
});
it("denies uploads to other workspaces", async () => {
  await expect(
    processSiteAsset(account, org, new File(["ID3"], "x.mp3", { type: "audio/mpeg" })),
  ).rejects.toMatchObject({ status: 403 });
  expect(m.upload).not.toHaveBeenCalled();
});
it("rejects fake audio and oversized files", async () => {
  await expect(
    processSiteAsset(account, null, new File(["html"], "x.mp3", { type: "audio/mpeg" })),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    processSiteAsset(
      account,
      null,
      new File([new Uint8Array(4194305)], "x.mp3", { type: "audio/mpeg" }),
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(m.upload).not.toHaveBeenCalled();
});
it("uploads valid audio to the authenticated owner", async () => {
  expect(
    await processSiteAsset(account, null, new File(["ID3audio"], "x.mp3", { type: "audio/mpeg" })),
  ).toEqual({ asset: { url: "https://storage.test/file.mp3", type: "audio", name: "x.mp3" } });
  expect(m.upload).toHaveBeenCalledWith(account, expect.any(Buffer), "audio/mpeg", "mp3");
});
