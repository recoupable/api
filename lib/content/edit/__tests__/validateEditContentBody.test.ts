import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const { editBodySchema } = await import("../validateEditContentBody");

describe("editBodySchema", () => {
  it("requires video_url", () => {
    const result = editBodySchema.safeParse({
      operations: [{ type: "crop", aspect: "9:16" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts video_url with crop operation", () => {
    const result = editBodySchema.safeParse({
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "crop", aspect: "9:16" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects audio_url without video_url", () => {
    const result = editBodySchema.safeParse({
      audio_url: "https://example.com/audio.mp3",
      operations: [{ type: "crop", aspect: "9:16" }],
    });
    expect(result.success).toBe(false);
  });

  it("does not accept mux_audio operation type", () => {
    const result = editBodySchema.safeParse({
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "mux_audio", audio_url: "https://example.com/audio.mp3" }],
    });
    expect(result.success).toBe(false);
  });

  it("does not accept audio_url as a parameter", () => {
    const result = editBodySchema.safeParse({
      video_url: "https://example.com/video.mp4",
      audio_url: "https://example.com/audio.mp3",
      operations: [{ type: "crop", aspect: "9:16" }],
    });
    if (result.success) {
      expect(result.data).not.toHaveProperty("audio_url");
    }
  });

  it("accepts trim operation", () => {
    const result = editBodySchema.safeParse({
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "trim", start: 0, duration: 5 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts overlay_text operation", () => {
    const result = editBodySchema.safeParse({
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "overlay_text", content: "hello" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts resize operation", () => {
    const result = editBodySchema.safeParse({
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "resize", width: 720 }],
    });
    expect(result.success).toBe(true);
  });
});
