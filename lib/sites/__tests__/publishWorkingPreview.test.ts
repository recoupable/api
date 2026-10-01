import { beforeEach, expect, it, vi } from "vitest";
import { readPublishableBuild } from "../production/readPublishableBuild";
const m = vi.hoisted(() => ({ verify: vi.fn(), list: vi.fn(), get: vi.fn(), hydrate: vi.fn() }));
vi.mock("../production/verifyGenerationJob", () => ({ verifyGenerationJob: m.verify }));
vi.mock("workflow/runtime", () => ({ getWorld: () => ({ steps: { list: m.list, get: m.get } }) }));
vi.mock("workflow/observability", () => ({ observabilityRevivers: {} }));
vi.mock("@workflow/core/serialization-format", () => ({
  hydrateDataWithKey: m.hydrate,
  isEncryptedData: () => false,
}));
const site = { id: "site", owner_id: "owner", revision: 2 } as any;
beforeEach(() => {
  vi.resetAllMocks();
  m.verify.mockReturnValue({ runId: "run" });
  m.list.mockResolvedValue({
    data: [{ stepId: "step", stepName: "step//buildTurnStep", status: "completed" }],
    hasMore: false,
  });
  m.get.mockResolvedValue({ output: {} });
});
it("recovers a saved build with its music context without requiring a review", async () => {
  const snapshot = { name: "Game", design: { experience: { html: "game" } } };
  m.hydrate.mockResolvedValue({
    site,
    snapshot,
    instruction: JSON.stringify({
      creativeContext: { release: { title: "Music" }, direction: {} },
    }),
  });
  const result = await readPublishableBuild("token", site, "account");
  expect(m.verify).toHaveBeenCalledWith("token", "site", "account");
  expect(result.production?.context).toEqual({ title: "Music" });
  expect(result.production?.status).toBe("needs-review");
});
it("rejects a build from an older generation", async () => {
  m.hydrate.mockResolvedValue({ site: { ...site, revision: 1 }, snapshot: {} });
  await expect(readPublishableBuild("token", site, "account")).rejects.toMatchObject({
    status: 409,
  });
});
it("does not publish incomplete source", async () => {
  m.hydrate.mockResolvedValue({ site });
  await expect(readPublishableBuild("token", site, "account")).rejects.toMatchObject({
    status: 400,
  });
});
it("rejects a foreign token before reading workflow data", async () => {
  m.verify.mockImplementation(() => {
    throw new Error("invalid");
  });
  await expect(readPublishableBuild("token", site, "account")).rejects.toThrow("invalid");
  expect(m.list).not.toHaveBeenCalled();
});
