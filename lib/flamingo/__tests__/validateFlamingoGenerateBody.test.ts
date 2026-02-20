import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateFlamingoGenerateBody } from "../validateFlamingoGenerateBody";

describe("validateFlamingoGenerateBody", () => {
  describe("custom prompt mode", () => {
    it("accepts a valid body with only prompt and applies defaults", () => {
      const result = validateFlamingoGenerateBody({
        prompt: "What genre is this track?",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toMatchObject({
        prompt: "What genre is this track?",
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
      const result = validateFlamingoGenerateBody({ prompt: "" });

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
