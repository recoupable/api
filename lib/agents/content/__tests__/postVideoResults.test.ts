import { describe, it, expect, vi, beforeEach } from "vitest";
import { postVideoResults } from "../postVideoResults";

vi.mock("../downloadVideoBuffer", () => ({
  downloadVideoBuffer: vi.fn(),
}));

const { downloadVideoBuffer } = await import("../downloadVideoBuffer");
const mockedDownload = vi.mocked(downloadVideoBuffer);

describe("postVideoResults", () => {
  let thread: { post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    thread = { post: vi.fn().mockResolvedValue(undefined) };
  });

  it("downloads videos in parallel and posts each as a file upload", async () => {
    const buf1 = Buffer.from([0x01]);
    const buf2 = Buffer.from([0x02]);
    mockedDownload.mockResolvedValueOnce(buf1).mockResolvedValueOnce(buf2);

    const videos = [
      { runId: "r1", status: "completed" as const, videoUrl: "https://cdn.example.com/v1.mp4" },
      { runId: "r2", status: "completed" as const, videoUrl: "https://cdn.example.com/v2.mp4" },
    ];

    await postVideoResults(thread as never, videos, 0);

    expect(mockedDownload).toHaveBeenCalledTimes(2);
    expect(thread.post).toHaveBeenCalledTimes(2);
    expect(thread.post).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.objectContaining({ filename: "v1.mp4" })],
      }),
    );
  });

  it("falls back to URL link when download fails", async () => {
    mockedDownload.mockResolvedValue(null);

    const videos = [
      { runId: "r1", status: "completed" as const, videoUrl: "https://cdn.example.com/v.mp4" },
    ];

    await postVideoResults(thread as never, videos, 0);

    expect(thread.post).toHaveBeenCalledWith(
      expect.stringContaining("https://cdn.example.com/v.mp4"),
    );
  });

  it("includes caption in markdown when present", async () => {
    mockedDownload.mockResolvedValue(Buffer.from([0x01]));

    const videos = [
      {
        runId: "r1",
        status: "completed" as const,
        videoUrl: "https://cdn.example.com/v.mp4",
        captionText: "great song",
      },
    ];

    await postVideoResults(thread as never, videos, 0);

    expect(thread.post).toHaveBeenCalledWith(
      expect.objectContaining({
        markdown: expect.stringContaining("great song"),
      }),
    );
  });

  it("posts failed run count when failedCount > 0", async () => {
    mockedDownload.mockResolvedValue(Buffer.from([0x01]));

    const videos = [
      { runId: "r1", status: "completed" as const, videoUrl: "https://cdn.example.com/v.mp4" },
    ];

    await postVideoResults(thread as never, videos, 2);

    const lastCall = thread.post.mock.calls[thread.post.mock.calls.length - 1][0];
    expect(lastCall).toContain("2");
    expect(lastCall).toContain("failed");
  });

  it("does not post failed message when failedCount is 0", async () => {
    mockedDownload.mockResolvedValue(Buffer.from([0x01]));

    const videos = [
      { runId: "r1", status: "completed" as const, videoUrl: "https://cdn.example.com/v.mp4" },
    ];

    await postVideoResults(thread as never, videos, 0);

    expect(thread.post).toHaveBeenCalledTimes(1);
  });

  it("labels videos when there are multiple", async () => {
    mockedDownload.mockResolvedValue(Buffer.from([0x01]));

    const videos = [
      { runId: "r1", status: "completed" as const, videoUrl: "https://cdn.example.com/v1.mp4" },
      { runId: "r2", status: "completed" as const, videoUrl: "https://cdn.example.com/v2.mp4" },
    ];

    await postVideoResults(thread as never, videos, 0);

    expect(thread.post).toHaveBeenCalledWith(
      expect.objectContaining({
        markdown: expect.stringContaining("Video 1"),
      }),
    );
  });

  it("posts static image before video when imageUrl is present", async () => {
    const imgBuf = Buffer.from([0x10]);
    const vidBuf = Buffer.from([0x20]);
    mockedDownload
      .mockResolvedValueOnce(imgBuf) // image download
      .mockResolvedValueOnce(vidBuf); // video download

    const videos = [
      {
        runId: "r1",
        status: "completed" as const,
        videoUrl: "https://cdn.example.com/v.mp4",
        imageUrl: "https://cdn.example.com/static.png",
      },
    ];

    await postVideoResults(thread as never, videos, 0);

    expect(thread.post).toHaveBeenCalledTimes(2);

    // First call: image
    expect(thread.post).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        markdown: "**Editorial Image**",
        files: [expect.objectContaining({ mimeType: "image/png" })],
      }),
    );

    // Second call: video
    expect(thread.post).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        files: [expect.objectContaining({ mimeType: "video/mp4" })],
      }),
    );
  });

  it("falls back to URL text when image download fails", async () => {
    mockedDownload
      .mockResolvedValueOnce(null) // image download fails
      .mockResolvedValueOnce(Buffer.from([0x20])); // video download

    const videos = [
      {
        runId: "r1",
        status: "completed" as const,
        videoUrl: "https://cdn.example.com/v.mp4",
        imageUrl: "https://cdn.example.com/static.png",
      },
    ];

    await postVideoResults(thread as never, videos, 0);

    expect(thread.post).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("https://cdn.example.com/static.png"),
    );
  });

  it("skips image posting when no imageUrl is present", async () => {
    mockedDownload.mockResolvedValue(Buffer.from([0x01]));

    const videos = [
      { runId: "r1", status: "completed" as const, videoUrl: "https://cdn.example.com/v.mp4" },
    ];

    await postVideoResults(thread as never, videos, 0);

    // Only the video post, no image
    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(thread.post).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.objectContaining({ mimeType: "video/mp4" })],
      }),
    );
  });
});
