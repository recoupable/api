import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeVideo } from "../analyzeVideo";

describe("analyzeVideo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("selects a supported model instead of the retired provider default", async () => {
    vi.stubEnv("TWELVELABS_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: "Inspected saved media", finish_reason: "stop" })),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeVideo({
      video_url: "https://example.com/saved-video.mp4",
      prompt: "Inspect this rendered campaign clip.",
      temperature: 0,
      max_tokens: 600,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model_name).toBe("pegasus1.5");
    expect(body.video).toEqual({ type: "url", url: "https://example.com/saved-video.mp4" });
    expect(result.text).toBe("Inspected saved media");
  });
});
