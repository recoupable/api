import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { postVideoResults } from "../postVideoResults";

vi.mock("../downloadVideoBuffer", () => ({
  downloadVideoBuffer: vi.fn(),
}));

const { downloadVideoBuffer } = await import("../downloadVideoBuffer");
const mockedDownload = vi.mocked(downloadVideoBuffer);

afterEach(() => vi.restoreAllMocks());

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
  it.each(["image/png", "image/jpeg", "image/webp", "image/gif"])(
    "posts an editorial image before the video using reported %s",
    async mimeType => {
      const imageFetch = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(new Uint8Array([1, 2]), { headers: { "content-type": mimeType } }),
        );
      mockedDownload.mockResolvedValue(Buffer.from([3]));
      await postVideoResults(
        thread,
        [
          {
            runId: "r1",
            status: "completed",
            videoUrl: "https://cdn.example.com/video.mp4",
            imageUrl: "https://cdn.example.com/image",
            captionText: "caption",
          },
        ],
        1,
      );
      expect(imageFetch).toHaveBeenCalledExactlyOnceWith("https://cdn.example.com/image");
      expect(thread.post).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          markdown: "**Editorial Image**",
          files: [
            {
              data: Buffer.from([1, 2]),
              filename: `editorial.${mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]}`,
              mimeType,
            },
          ],
        }),
      );
      expect(thread.post).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          markdown: "> caption",
          files: [expect.objectContaining({ mimeType: "video/mp4" })],
        }),
      );
      expect(thread.post).toHaveBeenNthCalledWith(3, "_1 run(s) failed._");
    },
  );

  it("keeps optional image buffers aligned and posts all images before videos", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("jpeg", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response("png", { headers: { "content-type": "image/png" } }));
    mockedDownload.mockResolvedValue(Buffer.from([1]));
    await postVideoResults(
      thread,
      [
        { runId: "r1", status: "completed", videoUrl: "https://cdn.example.com/one.mp4" },
        {
          runId: "r2",
          status: "completed",
          videoUrl: "https://cdn.example.com/two.mp4",
          imageUrl: "https://cdn.example.com/two.jpg",
        },
        {
          runId: "r3",
          status: "completed",
          videoUrl: "https://cdn.example.com/three.mp4",
          imageUrl: "https://cdn.example.com/three.png",
        },
      ],
      0,
    );
    expect(thread.post).toHaveBeenCalledTimes(5);
    expect(thread.post).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        files: [expect.objectContaining({ filename: "two.jpg", mimeType: "image/jpeg" })],
      }),
    );
    expect(thread.post).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        files: [expect.objectContaining({ filename: "three.png", mimeType: "image/png" })],
      }),
    );
    expect(thread.post).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ files: [expect.objectContaining({ filename: "one.mp4" })] }),
    );
  });

  it.each([404, 200])(
    "falls back to the image URL on failed download or unsupported MIME, without blocking video (%i)",
    async status => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("not an image", { status, headers: { "content-type": "text/html" } }),
      );
      mockedDownload.mockResolvedValue(Buffer.from([1]));
      await postVideoResults(
        thread,
        [
          {
            runId: "r1",
            status: "completed",
            videoUrl: "https://cdn.example.com/video.mp4",
            imageUrl: "https://cdn.example.com/image",
          },
        ],
        0,
      );
      expect(thread.post).toHaveBeenNthCalledWith(
        1,
        "**Editorial Image:** https://cdn.example.com/image",
      );
      expect(thread.post).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ files: [expect.objectContaining({ mimeType: "video/mp4" })] }),
      );
    },
  );

  it("does not fetch any image for legacy video-only results", async () => {
    const imageFetch = vi.spyOn(globalThis, "fetch");
    mockedDownload.mockResolvedValue(Buffer.from([1]));
    await postVideoResults(
      thread,
      [{ runId: "r1", status: "completed", videoUrl: "https://cdn.example.com/video.mp4" }],
      0,
    );
    expect(imageFetch).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledTimes(1);
  });
});
