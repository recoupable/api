import { describe, it, expect } from "vitest";
import { isAudioContentType } from "../isAudioContentType";

describe("isAudioContentType", () => {
  it("accepts any audio/* type", () => {
    expect(isAudioContentType("audio/mpeg")).toBe(true);
    expect(isAudioContentType("audio/wav")).toBe(true);
    expect(isAudioContentType("audio/x-flac")).toBe(true);
  });

  it("accepts application/octet-stream", () => {
    expect(isAudioContentType("application/octet-stream")).toBe(true);
  });

  it("rejects everything else, including empty", () => {
    expect(isAudioContentType("text/html")).toBe(false);
    expect(isAudioContentType("video/mp4")).toBe(false);
    expect(isAudioContentType("")).toBe(false);
  });
});
