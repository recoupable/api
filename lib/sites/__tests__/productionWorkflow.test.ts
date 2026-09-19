import { beforeEach, expect, it, vi } from "vitest";
import { siteProductionWorkflow } from "@/app/workflows/sites/siteProductionWorkflow";
import type { Site } from "../schema";
const m = vi.hoisted(() => ({ build: vi.fn(), save: vi.fn(), revise: vi.fn() }));
vi.mock("@/app/workflows/sites/collectContextStep", () => ({
  collectContextStep: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/app/workflows/sites/directionStep", () => ({
  directionStep: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/app/workflows/sites/assetsStep", () => ({ assetsStep: vi.fn().mockResolvedValue([]) }));
vi.mock("@/app/workflows/sites/buildStep", () => ({ buildStep: m.build }));
vi.mock("@/app/workflows/sites/reviewStep", () => ({
  reviewStep: vi.fn().mockResolvedValue({ verdict: "pass" }),
}));
vi.mock("@/app/workflows/sites/reviseStep", () => ({ reviseStep: m.revise }));
vi.mock("@/app/workflows/sites/saveSiteStep", () => ({ saveSiteStep: m.save }));
beforeEach(() => {
  vi.clearAllMocks();
  m.build.mockResolvedValue({});
  m.save.mockResolvedValue({ site: {} });
});
it("returns an explicit failure without saving when a stage fails", async () => {
  m.build.mockRejectedValue(new Error("Provider failure"));
  const result = await siteProductionWorkflow({ id: "site" } as Site, "", "account");
  expect(result).toHaveProperty("error");
  expect(m.save).not.toHaveBeenCalled();
  expect(m.revise).not.toHaveBeenCalled();
});
it("saves the reviewed candidate as a draft", async () => {
  await siteProductionWorkflow({ id: "site" } as Site, "", "account");
  expect(m.save.mock.calls[0][1].production.status).toBe("reviewed");
});

it("reports a save conflict without leaving the job running", async () => {
  m.save.mockRejectedValue(new Error("Newer revision exists"));
  expect(await siteProductionWorkflow({ id: "site" } as Site, "", "account")).toHaveProperty(
    "error",
  );
});
