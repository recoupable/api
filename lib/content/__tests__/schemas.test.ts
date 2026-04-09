import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const { createImageBodySchema } = await import("../image/validateCreateImageBody");
const { createVideoBodySchema } = await import("../video/validateCreateVideoBody");
const { createTextBodySchema } = await import("../caption/validateCreateCaptionBody");
const { createAudioBodySchema } = await import("../transcribe/validateTranscribeAudioBody");
const { editBodySchema } = await import("../edit/validateEditContentBody");
const { createUpscaleBodySchema } = await import("../upscale/validateUpscaleBody");
const { createAnalyzeBodySchema } = await import("../analyze/validateAnalyzeVideoBody");

describe("createImageBodySchema", () => {
  it("parses valid payload with prompt only", () => {
    expect(
      createImageBodySchema.safeParse({
        prompt: "a moody portrait",
      }).success,
    ).toBe(true);
  });

  it("parses valid payload with reference image", () => {
    expect(
      createImageBodySchema.safeParse({
        prompt: "portrait photo",
        reference_image_url: "https://example.com/ref.png",
      }).success,
    ).toBe(true);
  });

  it("parses empty payload (all fields optional)", () => {
    expect(createImageBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts custom model", () => {
    const result = createImageBodySchema.safeParse({
      prompt: "test",
      model: "fal-ai/some-other-model",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.model).toBe("fal-ai/some-other-model");
  });
});

describe("createVideoBodySchema", () => {
  it("parses prompt-only payload", () => {
    expect(
      createVideoBodySchema.safeParse({
        prompt: "a calm ocean",
      }).success,
    ).toBe(true);
  });

  it("parses animate mode with image", () => {
    expect(
      createVideoBodySchema.safeParse({
        mode: "animate",
        image_url: "https://example.com/img.png",
        prompt: "make it move",
      }).success,
    ).toBe(true);
  });

  it("parses extend mode with video", () => {
    expect(
      createVideoBodySchema.safeParse({
        mode: "extend",
        video_url: "https://example.com/clip.mp4",
        prompt: "continue the scene",
      }).success,
    ).toBe(true);
  });

  it("parses first-last mode with two images", () => {
    expect(
      createVideoBodySchema.safeParse({
        mode: "first-last",
        image_url: "https://example.com/start.png",
        end_image_url: "https://example.com/end.png",
        prompt: "transition between these",
      }).success,
    ).toBe(true);
  });

  it("parses lipsync mode", () => {
    expect(
      createVideoBodySchema.safeParse({
        mode: "lipsync",
        image_url: "https://example.com/face.png",
        audio_url: "https://example.com/audio.mp3",
      }).success,
    ).toBe(true);
  });

  it("defaults duration to 8s", () => {
    const result = createVideoBodySchema.safeParse({ prompt: "test" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.duration).toBe("8s");
  });

  it("defaults generate_audio to false", () => {
    const result = createVideoBodySchema.safeParse({ prompt: "test" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.generate_audio).toBe(false);
  });

  it("parses video with template", () => {
    expect(
      createVideoBodySchema.safeParse({
        template: "artist-caption-bedroom",
        prompt: "subtle motion",
      }).success,
    ).toBe(true);
  });
});

describe("createTextBodySchema", () => {
  it("parses valid payload", () => {
    expect(
      createTextBodySchema.safeParse({
        topic: "a rainy day in the city",
      }).success,
    ).toBe(true);
  });

  it("defaults length to short", () => {
    const result = createTextBodySchema.safeParse({
      topic: "test",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBe("short");
  });

  it("rejects missing topic", () => {
    expect(createTextBodySchema.safeParse({}).success).toBe(false);
  });
});

describe("createAudioBodySchema", () => {
  it("parses valid payload with audio URLs", () => {
    expect(
      createAudioBodySchema.safeParse({
        audio_urls: ["https://example.com/song.mp3"],
      }).success,
    ).toBe(true);
  });

  it("rejects non-URL strings", () => {
    expect(
      createAudioBodySchema.safeParse({
        audio_urls: ["not-a-url"],
      }).success,
    ).toBe(false);
  });

  it("rejects empty array", () => {
    expect(
      createAudioBodySchema.safeParse({
        audio_urls: [],
      }).success,
    ).toBe(false);
  });

  it("accepts custom model", () => {
    const result = createAudioBodySchema.safeParse({
      audio_urls: ["https://example.com/audio.mp3"],
      model: "fal-ai/custom-whisper",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.model).toBe("fal-ai/custom-whisper");
  });
});

describe("editBodySchema", () => {
  it("parses manual mode with operations", () => {
    expect(
      editBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
        operations: [{ type: "trim", start: 10, duration: 15 }],
      }).success,
    ).toBe(true);
  });

  it("parses template mode", () => {
    expect(
      editBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
        template: "artist-caption-bedroom",
      }).success,
    ).toBe(true);
  });

  it("rejects missing both template and operations", () => {
    expect(
      editBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
      }).success,
    ).toBe(false);
  });

  it("rejects missing all inputs", () => {
    expect(
      editBodySchema.safeParse({
        operations: [{ type: "trim", start: 0, duration: 5 }],
      }).success,
    ).toBe(false);
  });

  it("rejects audio_url without video_url", () => {
    expect(
      editBodySchema.safeParse({
        audio_url: "https://example.com/a.mp3",
        operations: [{ type: "trim", start: 0, duration: 15 }],
      }).success,
    ).toBe(false);
  });

  it("parses overlay_text operation", () => {
    expect(
      editBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
        operations: [{ type: "overlay_text", content: "hello world" }],
      }).success,
    ).toBe(true);
  });

  it("rejects mux_audio operation", () => {
    expect(
      editBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
        operations: [{ type: "mux_audio", audio_url: "https://example.com/a.mp3" }],
      }).success,
    ).toBe(false);
  });

  it("parses crop operation", () => {
    expect(
      editBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
        operations: [{ type: "crop", aspect: "9:16" }],
      }).success,
    ).toBe(true);
  });

  it("parses multiple operations", () => {
    expect(
      editBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
        operations: [
          { type: "trim", start: 30, duration: 15 },
          { type: "crop", aspect: "9:16" },
          { type: "overlay_text", content: "caption" },
        ],
      }).success,
    ).toBe(true);
  });

  it("defaults output_format to mp4", () => {
    const result = editBodySchema.safeParse({
      video_url: "https://example.com/v.mp4",
      operations: [{ type: "trim", start: 0, duration: 5 }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.output_format).toBe("mp4");
  });
});

describe("createUpscaleBodySchema", () => {
  it("parses image upscale", () => {
    expect(
      createUpscaleBodySchema.safeParse({
        url: "https://example.com/img.png",
        type: "image",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(
      createUpscaleBodySchema.safeParse({
        url: "https://example.com/f",
        type: "audio",
      }).success,
    ).toBe(false);
  });
});

describe("createAnalyzeBodySchema", () => {
  it("parses valid payload", () => {
    expect(
      createAnalyzeBodySchema.safeParse({
        video_url: "https://example.com/video.mp4",
        prompt: "Describe what happens in this video",
      }).success,
    ).toBe(true);
  });

  it("defaults temperature to 0.2", () => {
    const result = createAnalyzeBodySchema.safeParse({
      video_url: "https://example.com/video.mp4",
      prompt: "Describe this video",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.temperature).toBe(0.2);
  });

  it("rejects prompt exceeding 2000 chars", () => {
    expect(
      createAnalyzeBodySchema.safeParse({
        video_url: "https://example.com/video.mp4",
        prompt: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("rejects invalid video_url", () => {
    expect(
      createAnalyzeBodySchema.safeParse({
        video_url: "not-a-url",
        prompt: "Describe this video",
      }).success,
    ).toBe(false);
  });
});
