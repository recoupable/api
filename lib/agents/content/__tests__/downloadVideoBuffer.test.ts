import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadVideoBuffer } from "../downloadVideoBuffer";

describe("downloadVideoBuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns a Buffer with the video data on success", async () => {
    const fakeData = new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(fakeData, {
        status: 200,
        headers: { "content-type": "video/mp4" },
      }),
    );

    const result = await downloadVideoBuffer("https://example.com/video.mp4");
    expect(result).toBeInstanceOf(Buffer);
    expect(result!.length).toBe(fakeData.length);
  });

  it("returns null when fetch returns a non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Not Found", { status: 404 }));

    const result = await downloadVideoBuffer("https://example.com/missing.mp4");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await downloadVideoBuffer("https://example.com/video.mp4");
    expect(result).toBeNull();
  });

  it("extracts the filename from the URL path", async () => {
    const fakeData = new Uint8Array([0x01, 0x02]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(fakeData, { status: 200 }));

    const result = await downloadVideoBuffer(
      "https://cdn.example.com/path/to/my-video.mp4?token=abc",
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});
