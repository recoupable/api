import { beforeEach, expect, it, vi } from "vitest";
import { startSiteProduction } from "../production/startSiteProduction";
import { getSiteProduction } from "../production/getSiteProduction";
import { signGenerationJob } from "../production/signGenerationJob";
import type { Site } from "../schema";
const m = vi.hoisted(() => ({
  update: vi.fn(),
  start: vi.fn(),
  getRun: vi.fn(),
  credits: vi.fn(),
}));
vi.mock("@/lib/supabase/sites/updateSite", () => ({ updateSite: m.update }));
vi.mock("workflow/api", () => ({ start: m.start, getRun: m.getRun }));
vi.mock("@/app/workflows/sites/siteProductionWorkflow", () => ({
  siteProductionWorkflow: vi.fn(),
}));
vi.mock("../production/requireCredits", () => ({ requireCredits: m.credits }));
const site = { id: "site", owner_id: "workspace", revision: 3 } as Site;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SITES_JOB_SECRET", "test-only");
  m.update.mockResolvedValue({ ...site, revision: 4 });
  m.start.mockResolvedValue({ runId: "run" });
});
it("claims the expected revision before starting billable work", async () => {
  await startSiteProduction(site, "", "account");
  expect(m.update).toHaveBeenCalledWith("site", "workspace", 3, {});
  expect(m.start.mock.calls[0][1][0].revision).toBe(4);
});
it("rejects a duplicate generation without starting another workflow", async () => {
  m.update.mockResolvedValue(null);
  await expect(startSiteProduction(site, "", "account")).rejects.toThrow(
    "Generation already started",
  );
  expect(m.start).not.toHaveBeenCalled();
});
it("does not inspect another account's generation", async () => {
  const token = signGenerationJob("run", "site", "account");
  await expect(getSiteProduction(token, "site", "other")).rejects.toThrow();
  expect(m.getRun).not.toHaveBeenCalled();
});
it("returns the saved draft only after workflow completion", async () => {
  const token = signGenerationJob("run", "site", "account");
  m.getRun.mockReturnValue({
    status: Promise.resolve("completed"),
    returnValue: Promise.resolve({ site }),
  });
  expect(await getSiteProduction(token, "site", "account")).toEqual({
    generation: { status: "completed" },
    site,
  });
});

it("surfaces a caught stage failure instead of reporting a completed draft", async () => {
  const token = signGenerationJob("run", "site", "account");
  m.getRun.mockReturnValue({
    status: Promise.resolve("completed"),
    returnValue: Promise.resolve({ error: "Build stopped" }),
  });
  expect(await getSiteProduction(token, "site", "account")).toEqual({
    generation: { status: "failed" },
    error: "Build stopped",
  });
});
