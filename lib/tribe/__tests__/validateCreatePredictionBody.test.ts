import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateCreatePredictionBody } from "../validateCreatePredictionBody";

describe("validateCreatePredictionBody", () => {
  it("accepts valid video prediction body", () => {
    const result = validateCreatePredictionBody({
      file_url: "https://storage.example.com/video.mp4",
      modality: "video",
    });
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      file_url: "https://storage.example.com/video.mp4",
      modality: "video",
    });
  });

  it("accepts valid audio prediction body", () => {
    const result = validateCreatePredictionBody({
      file_url: "https://storage.example.com/track.mp3",
      modality: "audio",
    });
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("accepts valid text prediction body", () => {
    const result = validateCreatePredictionBody({
      file_url: "https://storage.example.com/lyrics.txt",
      modality: "text",
    });
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("rejects missing file_url", () => {
    const result = validateCreatePredictionBody({ modality: "video" });
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("rejects invalid file_url", () => {
    const result = validateCreatePredictionBody({
      file_url: "not-a-url",
      modality: "video",
    });
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("rejects missing modality", () => {
    const result = validateCreatePredictionBody({
      file_url: "https://example.com/file.mp4",
    });
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("rejects invalid modality", () => {
    const result = validateCreatePredictionBody({
      file_url: "https://example.com/file.mp4",
      modality: "image",
    });
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("rejects empty body", () => {
    const result = validateCreatePredictionBody({});
    expect(result).toBeInstanceOf(NextResponse);
  });
});
