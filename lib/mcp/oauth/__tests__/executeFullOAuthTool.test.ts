import { beforeEach, describe, it, expect, vi } from "vitest";
import { executeFullOAuthTool } from "../executeFullOAuthTool";
const mocks = vi.hoisted(() => ({ run: vi.fn(), video: vi.fn(), tasks: vi.fn() }));
vi.mock("@/lib/trigger/retrieveTaskRun", () => ({ retrieveTaskRun: mocks.run }));
vi.mock("@/lib/video/retrieveVideo", () => ({ retrieveVideoFunction: mocks.video }));
vi.mock("@/lib/video/retrieveVideoContent", () => ({ retrieveVideoContentFunction: mocks.video }));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: mocks.tasks,
}));
const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OAUTH_INDEX_KEY", Buffer.alloc(32, 7).toString("base64"));
  mocks.video.mockResolvedValue({ success: true, id: "video_1" });
  mocks.tasks.mockResolvedValue([]);
});
describe("delegated job ownership", () => {
  it("returns a caller-bound locator and rejects raw IDs, tampering, and other callers", async () => {
    const result = await executeFullOAuthTool("generate_sora_2_video", {}, "owner", async () =>
      ok({ success: true, id: "video_1" }),
    );
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.id).not.toBe("video_1");
    await executeFullOAuthTool("retrieve_sora_2_video", { video_id: data.id }, "owner", vi.fn());
    expect(mocks.video).toHaveBeenCalledWith({ video_id: "video_1" });
    for (const [video_id, owner] of [
      ["video_1", "owner"],
      [data.id, "other"],
      [data.id + "x", "owner"],
    ]) {
      await expect(
        executeFullOAuthTool("retrieve_sora_2_video", { video_id }, owner, vi.fn()),
      ).rejects.toThrow();
    }
    expect(mocks.video).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign or unattributed Trigger runs", async () => {
    for (const payload of [{ accountId: "other" }, {}]) {
      mocks.run.mockResolvedValue({ id: "run_1", payload, status: "COMPLETED" });
      await expect(
        executeFullOAuthTool("get_task_run_status", { runId: "run_1" }, "owner", vi.fn()),
      ).rejects.toThrow();
    }
  });
  it("returns only safe status fields for an owned run", async () => {
    mocks.run.mockResolvedValue({
      id: "run_1",
      payload: { accountId: "owner", secret: "hidden" },
      metadata: { secret: "hidden" },
      output: { secret: "hidden" },
      status: "COMPLETED",
    });
    const result = await executeFullOAuthTool(
      "get_task_run_status",
      { runId: "run_1" },
      "owner",
      vi.fn(),
    );
    expect(JSON.stringify(result)).not.toContain("hidden");
    expect(JSON.stringify(result)).toContain("COMPLETED");
  });
  it("authorizes scheduled runs through their persisted task owner", async () => {
    mocks.run.mockResolvedValue({
      id: "run_1",
      payload: { externalId: "task_1" },
      status: "COMPLETED",
    });
    mocks.tasks.mockResolvedValue([{ id: "task_1", account_id: "owner" }]);
    await expect(
      executeFullOAuthTool("get_task_run_status", { runId: "run_1" }, "owner", vi.fn()),
    ).resolves.toBeDefined();
    expect(mocks.tasks).toHaveBeenCalledWith({ id: "task_1", account_id: "owner" });
  });
});
