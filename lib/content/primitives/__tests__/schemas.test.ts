import { describe, it, expect } from "vitest";
import {
  createImageBodySchema,
  createVideoBodySchema,
  createTextBodySchema,
  createAudioBodySchema,
  createRenderBodySchema,
  createUpscaleBodySchema,
  createAnalyzeBodySchema,
} from "../schemas";

describe("createImageBodySchema", () => {
  it("parses valid payload", () => {
    expect(
      createImageBodySchema.safeParse({
        artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
        template: "artist-caption-bedroom",
      }).success,
    ).toBe(true);
  });

  it("rejects non-UUID artist_account_id", () => {
    expect(
      createImageBodySchema.safeParse({
        artist_account_id: "not-a-uuid",
        template: "artist-caption-bedroom",
      }).success,
    ).toBe(false);
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
});

describe("createTextBodySchema", () => {
  it("parses valid payload", () => {
    expect(
      createTextBodySchema.safeParse({
        artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
        song: "safe-boy-bestie",
      }).success,
    ).toBe(true);
  });

  it("defaults length to short", () => {
    const result = createTextBodySchema.safeParse({
      artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
      song: "test",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBe("short");
  });
});

describe("createAudioBodySchema", () => {
  it("parses valid payload", () => {
    expect(
      createAudioBodySchema.safeParse({
        artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(true);
  });
});

describe("createRenderBodySchema", () => {
  it("parses valid payload", () => {
    expect(
      createRenderBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
        song_url: "https://example.com/s.mp3",
        audio_start_seconds: 10,
        audio_duration_seconds: 15,
        text: { content: "hello" },
      }).success,
    ).toBe(true);
  });

  it("rejects missing text content", () => {
    expect(
      createRenderBodySchema.safeParse({
        video_url: "https://example.com/v.mp4",
        song_url: "https://example.com/s.mp3",
        audio_start_seconds: 10,
        audio_duration_seconds: 15,
        text: {},
      }).success,
    ).toBe(false);
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
