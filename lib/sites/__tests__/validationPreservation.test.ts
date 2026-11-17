import { beforeEach, expect, it, vi } from "vitest";
import { cancelSiteProduction } from "../production/cancelSiteProduction";
import { saveSiteStep } from "@/app/workflows/sites/saveSiteStep";
import type { Site, SiteSnapshot } from "../schema";
const m = vi.hoisted(() => ({
  verify: vi.fn(),
  getRun: vi.fn(),
  cancel: vi.fn(),
  authorize: vi.fn(),
  update: vi.fn(),
}));
vi.mock("../production/verifyGenerationJob", () => ({ verifyGenerationJob: m.verify }));
vi.mock("workflow/api", () => ({ getRun: m.getRun }));
vi.mock("@/lib/sites/authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: m.authorize }));
vi.mock("@/lib/supabase/sites/updateSite", () => ({ updateSite: m.update }));
vi.mock("../production/readSiteContextBrief", () => ({ readSiteContextBrief: vi.fn() }));
vi.mock("../production/resolveSiteArtist", () => ({ resolveSiteArtist: vi.fn(async () => null) }));
beforeEach(() => {
  vi.resetAllMocks();
  m.verify.mockReturnValue({ runId: "run" });
});
it("cancels only the signed site/account run without writing a candidate or publication", async () => {
  m.getRun.mockReturnValue({ status: Promise.resolve("running"), cancel: m.cancel });
  await cancelSiteProduction("synthetic-token", "site", "account");
  expect(m.verify).toHaveBeenCalledWith("synthetic-token", "site", "account");
  expect(m.getRun).toHaveBeenCalledWith("run");
  expect(m.cancel).toHaveBeenCalledOnce();
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects a foreign cancellation before accessing a run", async () => {
  m.verify.mockImplementation(() => {
    throw new Error("Wrong account");
  });
  await expect(cancelSiteProduction("foreign", "site", "account")).rejects.toThrow("Wrong account");
  expect(m.getRun).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});
it.each(["completed", "failed", "cancelled"])("does not recancel a %s run", async status => {
  m.getRun.mockReturnValue({ status: Promise.resolve(status), cancel: m.cancel });
  await cancelSiteProduction("synthetic-token", "site", "account");
  expect(m.cancel).not.toHaveBeenCalled();
});
it("rejects stale-revision evidence at save without retrying over the newer draft or publishing", async () => {
  const site = {
    id: "site",
    owner_id: "workspace",
    revision: 3,
    draft: { name: "Last good" },
    published: { name: "Published" },
  } as Site;
  const candidate = { name: "Reviewed candidate" } as SiteSnapshot;
  const original = structuredClone(site);
  m.update.mockResolvedValue(null);
  await expect(saveSiteStep(site, candidate, "account")).rejects.toThrow(
    "newer draft was preserved",
  );
  expect(m.authorize).toHaveBeenCalledWith("account", "workspace");
  expect(m.update).toHaveBeenCalledExactlyOnceWith("site", "workspace", 3, {
    draft: candidate,
    artist_id: null,
  });
  expect(site).toEqual(original);
});
