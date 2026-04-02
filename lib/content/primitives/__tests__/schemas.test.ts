import { describe, it, expect } from "vitest";
import {
  createImageBodySchema,
  createVideoBodySchema,
  createTextBodySchema,
  createAudioBodySchema,
  editBodySchema,
  createUpscaleBodySchema,
  createAnalyzeBodySchema,
} from "../schemas";

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
  it("parses valid payload", () => {
    expect(
      createVideoBodySchema.safeParse({
        image_url: "https://example.com/img.png",
      }).success,
    ).toBe(true);
  });

  it("defaults lipsync to false", () => {
    const result = createVideoBodySchema.safeParse({
      image_url: "https://example.com/img.png",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lipsync).toBe(false);
  });

  it("accepts audio_url for lipsync", () => {
    const result = createVideoBodySchema.safeParse({
      image_url: "https://example.com/img.png",
      lipsync: true,
      audio_url: "https://example.com/audio.mp3",
    });
    expect(result.success).toBe(true);
  });

  it("accepts custom model", () => {
    const result = createVideoBodySchema.safeParse({
      image_url: "https://example.com/img.png",
      model: "fal-ai/custom-video-model",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.model).toBe("fal-ai/custom-video-model");
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

  it("accepts audio_url as input", () => {
    expect(
      editBodySchema.safeParse({
        audio_url: "https://example.com/a.mp3",
        operations: [{ type: "trim", start: 0, duration: 15 }],
      }).success,
    ).toBe(true);
  });

  it("parses overlay_text operation", () => {
    expect(
      editBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
        operations: [{ type: "overlay_text", content: "hello world" }],
      }).success,
    ).toBe(true);
  });

  it("parses mux_audio operation", () => {
    expect(
      editBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
        operations: [{ type: "mux_audio", audio_url: "https://example.com/a.mp3" }],
      }).success,
    ).toBe(true);
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
          { type: "mux_audio", audio_url: "https://example.com/a.mp3" },
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

  it("defaults stream to false", () => {
    const result = createAnalyzeBodySchema.safeParse({
      video_url: "https://example.com/video.mp4",
      prompt: "Describe this video",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stream).toBe(false);
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
