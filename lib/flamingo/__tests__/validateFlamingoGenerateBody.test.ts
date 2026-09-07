import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateFlamingoGenerateBody } from "../validateFlamingoGenerateBody";

describe("validateFlamingoGenerateBody", () => {
  describe("custom prompt mode", () => {
    it("accepts a prompt with an audio_url and applies defaults", () => {
      const result = validateFlamingoGenerateBody({
        prompt: "What genre is this track?",
        audio_url: "https://example.com/song.mp3",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toMatchObject({
        prompt: "What genre is this track?",
        audio_url: "https://example.com/song.mp3",
      });
      expect(result).toHaveProperty("max_new_tokens", 512);
      expect(result).toHaveProperty("temperature", 1.0);
      expect(result).toHaveProperty("top_p", 1.0);
      expect(result).toHaveProperty("do_sample", false);
    });

    it("accepts a valid body with all optional fields", () => {
      const result = validateFlamingoGenerateBody({
        prompt: "Describe the mood of this song.",
        audio_url: "https://example.com/song.mp3",
        max_new_tokens: 256,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        prompt: "Describe the mood of this song.",
        audio_url: "https://example.com/song.mp3",
        max_new_tokens: 256,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
      });
    });
  });

  describe("preset mode", () => {
    it("accepts a valid preset name", () => {
      const result = validateFlamingoGenerateBody({
        preset: "catalog_metadata",
        audio_url: "https://example.com/song.mp3",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toMatchObject({
        preset: "catalog_metadata",
        audio_url: "https://example.com/song.mp3",
      });
    });

    it("accepts full_report preset", () => {
      const result = validateFlamingoGenerateBody({
        preset: "full_report",
        audio_url: "https://example.com/song.mp3",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toMatchObject({ preset: "full_report" });
    });

    it("returns 400 for invalid preset name", () => {
      const result = validateFlamingoGenerateBody({
        preset: "nonexistent_preset",
        audio_url: "https://example.com/song.mp3",
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when both preset and prompt are provided", () => {
      const result = validateFlamingoGenerateBody({
        preset: "catalog_metadata",
        prompt: "Describe this track.",
        audio_url: "https://example.com/song.mp3",
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });

  describe("audio_url is required in every mode", () => {
    it("returns 400 with missing_fields [audio_url] for a prompt without audio", async () => {
      const result = validateFlamingoGenerateBody({ prompt: "Describe this track." });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
      expect(await (result as NextResponse).json()).toEqual({
        status: "error",
        missing_fields: ["audio_url"],
        error: "audio_url is required",
      });
    });

    it("returns 400 with missing_fields [audio_url] for a preset without audio", async () => {
      const result = validateFlamingoGenerateBody({ preset: "mood_tags" });

      expect(result).toBeInstanceOf(NextResponse);
      expect(await (result as NextResponse).json()).toMatchObject({
        missing_fields: ["audio_url"],
      });
    });

    it("exposes audio_url as a required string on the inferred type", () => {
      const result = validateFlamingoGenerateBody({
        preset: "mood_tags",
        audio_url: "https://example.com/song.mp3",
      });
      if (result instanceof NextResponse) throw new Error("expected a body");
      const audioUrl: string = result.audio_url;

      expect(audioUrl).toBe("https://example.com/song.mp3");
    });
  });

  describe("error cases", () => {
    it("returns 400 when neither preset nor prompt is provided", () => {
      const result = validateFlamingoGenerateBody({
        audio_url: "https://example.com/song.mp3",
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when body is empty", () => {
      const result = validateFlamingoGenerateBody({});

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when prompt is empty string", () => {
      const result = validateFlamingoGenerateBody({
        prompt: "",
        audio_url: "https://example.com/song.mp3",
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when audio_url is not a valid URL", () => {
      const result = validateFlamingoGenerateBody({
        prompt: "Describe this track.",
        audio_url: "not-a-url",
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when max_new_tokens exceeds 2048", () => {
      const result = validateFlamingoGenerateBody({
        prompt: "Describe this track.",
        audio_url: "https://example.com/song.mp3",
        max_new_tokens: 5000,
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when body is null", () => {
      const result = validateFlamingoGenerateBody(null);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });
});
