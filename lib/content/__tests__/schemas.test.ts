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

  it("parses valid payload with reference images to edit", () => {
    expect(
      createImageBodySchema.safeParse({
        prompt: "portrait photo",
        image_urls: ["https://example.com/ref.png"],
      }).success,
    ).toBe(true);
  });

  it("rejects more than 10 reference images — Muse Image's real cap", () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}.png`);
    expect(createImageBodySchema.safeParse({ image_urls: urls }).success).toBe(false);
  });

  it("parses empty payload (all fields optional)", () => {
    expect(createImageBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts output_format and sync_mode — real Muse Image params", () => {
    const result = createImageBodySchema.safeParse({
      prompt: "test",
      output_format: "png",
      sync_mode: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output_format).toBe("png");
      expect(result.data.sync_mode).toBe(true);
    }
  });

  it("defaults output_format to webp and sync_mode to false", () => {
    const result = createImageBodySchema.safeParse({ prompt: "test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output_format).toBe("webp");
      expect(result.data.sync_mode).toBe(false);
    }
  });

  it("rejects an aspect_ratio Muse Image does not support", () => {
    expect(createImageBodySchema.safeParse({ prompt: "test", aspect_ratio: "5:4" }).success).toBe(
      false,
    );
  });

  it("does not carry template, resolution, or a caller-supplied model — dropped params", () => {
    const result = createImageBodySchema.safeParse({
      prompt: "test",
      template: "artist-caption-bedroom",
      resolution: "2K",
      model: "fal-ai/some-other-model",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("template" in result.data).toBe(false);
      expect("resolution" in result.data).toBe(false);
      expect("model" in result.data).toBe(false);
    }
  });
});

describe("createVideoBodySchema", () => {
  it("parses prompt-only payload (text-to-video, image_url omitted)", () => {
    expect(
      createVideoBodySchema.safeParse({
        prompt: "a calm ocean",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing prompt — H3 Max requires it", () => {
    expect(createVideoBodySchema.safeParse({}).success).toBe(false);
  });

  it("parses image-to-video with an end frame", () => {
    expect(
      createVideoBodySchema.safeParse({
        prompt: "transition between these",
        image_url: "https://example.com/start.png",
        end_image_url: "https://example.com/end.png",
      }).success,
    ).toBe(true);
  });

  it("defaults prompt_expansion_mode to balanced", () => {
    const result = createVideoBodySchema.safeParse({ prompt: "test" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.prompt_expansion_mode).toBe("balanced");
  });

  it("defaults duration to 5 seconds and resolution to 768P — H3 Max's real defaults", () => {
    const result = createVideoBodySchema.safeParse({ prompt: "test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration).toBe(5);
      expect(result.data.resolution).toBe("768P");
    }
  });

  it("rejects a duration outside H3 Max's 5-15s range", () => {
    expect(createVideoBodySchema.safeParse({ prompt: "test", duration: 20 }).success).toBe(false);
    expect(createVideoBodySchema.safeParse({ prompt: "test", duration: 3 }).success).toBe(false);
  });

  it("rejects a resolution H3 Max does not support", () => {
    expect(createVideoBodySchema.safeParse({ prompt: "test", resolution: "1080p" }).success).toBe(
      false,
    );
  });

  it("accepts seed, enable_safety_checker, and sync_mode — real H3 Max params", () => {
    const result = createVideoBodySchema.safeParse({
      prompt: "test",
      seed: 123,
      enable_safety_checker: false,
      sync_mode: true,
    });
    expect(result.success).toBe(true);
  });

  it("does not carry mode, template, video_url, audio_url, aspect_ratio, negative_prompt, or generate_audio — dropped params", () => {
    const result = createVideoBodySchema.safeParse({
      prompt: "test",
      mode: "lipsync",
      template: "artist-caption-bedroom",
      video_url: "https://example.com/clip.mp4",
      audio_url: "https://example.com/audio.mp3",
      aspect_ratio: "16:9",
      negative_prompt: "no text",
      generate_audio: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      for (const key of [
        "mode",
        "template",
        "video_url",
        "audio_url",
        "aspect_ratio",
        "negative_prompt",
        "generate_audio",
      ]) {
        expect(key in result.data).toBe(false);
      }
    }
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

  it("rejects length of 'none' — caption endpoint is only invoked when captions are wanted", () => {
    const result = createTextBodySchema.safeParse({
      topic: "test",
      length: "none",
    });
    expect(result.success).toBe(false);
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
