import { describe, it, expect } from "vitest";
import { getFilenameFromUrl } from "../getFilenameFromUrl";

describe("getFilenameFromUrl", () => {
  it("extracts filename from a simple URL", () => {
    expect(getFilenameFromUrl("https://cdn.example.com/path/to/video.mp4")).toBe("video.mp4");
  });

  it("extracts filename from URL with query params", () => {
    expect(getFilenameFromUrl("https://cdn.example.com/video.mp4?token=abc&t=123")).toBe(
      "video.mp4",
    );
  });

  it("handles URL-encoded characters", () => {
    expect(
      getFilenameFromUrl("https://cdn.example.com/my%20video%20file.mp4"),
    ).toBe("my%20video%20file.mp4");
  });

  it("falls back to video.mp4 when URL has no extension", () => {
    expect(getFilenameFromUrl("https://cdn.example.com/path/to/video")).toBe("video.mp4");
  });

  it("falls back to video.mp4 when URL path ends with slash", () => {
    expect(getFilenameFromUrl("https://cdn.example.com/path/")).toBe("video.mp4");
  });

  it("falls back to video.mp4 for invalid URLs", () => {
    expect(getFilenameFromUrl("not-a-url")).toBe("video.mp4");
  });

  it("handles fal.ai storage URLs", () => {
    expect(
      getFilenameFromUrl(
        "https://v3b.fal.media/files/b/0a9486c8/sjfeqG-MFh_3aG213aIU2_final-video.mp4",
      ),
    ).toBe("sjfeqG-MFh_3aG213aIU2_final-video.mp4");
  });
});
