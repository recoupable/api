import { beforeEach, expect, it, vi } from "vitest";
import { readSiteBuildProgress } from "../production/readSiteBuildProgress";
const list = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
vi.mock("workflow/observability", () => ({
  hydrateResourceIO: (value: unknown) => value,
  observabilityRevivers: {},
}));
vi.mock("workflow/runtime", () => ({ getWorld: () => ({ steps: { list, get } }) }));
const step = (name: string, time: number) => ({
  stepName: `step//path//${name}`,
  status: "completed",
  createdAt: new Date(time),
});
beforeEach(() => vi.resetAllMocks());
it("reads metadata only and reports queued before any step starts", async () => {
  list.mockResolvedValue({ data: [], hasMore: false });
  expect((await readSiteBuildProgress("run")).phase).toBe("queued");
  expect(list).toHaveBeenCalledWith(expect.objectContaining({ runId: "run", resolveData: "none" }));
});
it("shows the latest specific research activity", async () => {
  list.mockResolvedValue({
    data: [step("metadataStep", 1), step("audioAnalysisStep", 2)],
    hasMore: false,
  });
  expect(await readSiteBuildProgress("run")).toMatchObject({
    phase: "research",
    detail: "Analyzing the audio and lyrics",
  });
});
it("keeps revisions in test and refine, even with paginated history", async () => {
  list.mockResolvedValueOnce({ data: [step("buildTurnStep", 3)], hasMore: true, cursor: "next" });
  list.mockResolvedValueOnce({
    data: [step("reviewStep", 2), step("buildTurnStep", 1)],
    hasMore: false,
  });
  expect(await readSiteBuildProgress("run")).toEqual({
    phase: "review",
    detail: "Refining the experience after review",
    reviewPass: 1,
  });
  expect(list.mock.calls[1][0].pagination.cursor).toBe("next");
});
it("reports saving instead of falsely claiming a ready preview", async () => {
  list.mockResolvedValue({
    data: [step("saveSiteStep", 3), step("reviewStep", 2)],
    hasMore: false,
  });
  expect((await readSiteBuildProgress("run")).detail).toBe("Saving your preview");
});

it("reads only the latest completed explicit reveal and strips extra fields", async () => {
  list.mockResolvedValue({
    data: [
      { ...step("revealBuildStep", 3), stepId: "safe" },
      { ...step("buildTurnStep", 2), stepId: "private" },
    ],
    hasMore: false,
  });
  get.mockResolvedValue({ output: { concept: "Make a letter", assets: [], secret: "private" } });
  expect(await readSiteBuildProgress("run")).toMatchObject({
    reveal: { concept: "Make a letter", assets: [] },
  });
  expect(get).toHaveBeenCalledOnce();
  expect(get).toHaveBeenCalledWith("run", "safe", { resolveData: "all" });
});
it("keeps reporting progress when a reveal cannot be read", async () => {
  list.mockResolvedValue({
    data: [{ ...step("revealBuildStep", 3), stepId: "safe" }, step("reviewStep", 4)],
    hasMore: false,
  });
  get.mockRejectedValue(new Error("Unavailable"));
  expect(await readSiteBuildProgress("run")).toMatchObject({ phase: "review", reviewPass: 1 });
});
