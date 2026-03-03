import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerRenderVideo } from "@/lib/trigger/triggerRenderVideo";

import { tasks } from "@trigger.dev/sdk";

vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: vi.fn(),
  },
}));

describe("triggerRenderVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers the render-video task with the full payload", async () => {
    const mockHandle = { id: "run_render_abc123" };
    vi.mocked(tasks.trigger).mockResolvedValue(mockHandle as never);

    const payload = {
      compositionId: "SocialPost",
      inputProps: { videoUrl: "https://example.com/video.mp4" },
      width: 720,
      height: 1280,
      fps: 30,
      durationInFrames: 240,
      codec: "h264" as const,
      accountId: "account-uuid-123",
    };

    const result = await triggerRenderVideo(payload);

    expect(tasks.trigger).toHaveBeenCalledWith("render-video", payload);
    expect(result).toEqual(mockHandle);
  });

  it("returns the task handle with runId", async () => {
    const mockHandle = { id: "run_xyz789" };
    vi.mocked(tasks.trigger).mockResolvedValue(mockHandle as never);

    const result = await triggerRenderVideo({
      compositionId: "CommitShowcase",
      inputProps: {},
      width: 1080,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
      codec: "h264",
      accountId: "another-account-id",
    });

    expect(result.id).toBe("run_xyz789");
  });
});
