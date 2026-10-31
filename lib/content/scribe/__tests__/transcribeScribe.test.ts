import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeScribe } from "../transcribeScribe";

const subscribe = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fal/server", () => ({ default: { subscribe } }));
const MODEL = "fal-ai/elevenlabs/speech-to-text/scribe-v2";
const audioUrl = "https://example.invalid/approved-song.wav";
const data = {
  text: "Hello world",
  language_code: "eng",
  language_probability: 0.97,
  words: [
    { text: "Hello", type: "word", start: 0.1, end: 0.5, speaker_id: "speaker_0" },
    { text: " ", type: "spacing" },
    { text: "world", type: "word", start: 0.6, end: 1.1 },
    { text: "[music]", type: "audio_event", start: 1.2, end: 2 },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  subscribe.mockResolvedValue({ requestId: "request_fixture", data });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Real HTTP forbidden");
    }),
  );
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
describe("explicit Scribe adapter (not registered for production use)", () => {
  it("pins Scribe V2, preserves word/event provenance and uses no Whisper fields", async () => {
    const result = await transcribeScribe({ audio_url: audioUrl });
    expect(subscribe).toHaveBeenCalledExactlyOnceWith(MODEL, {
      input: { audio_url: audioUrl, diarize: false, tag_audio_events: true },
    });
    expect(result).toMatchObject({
      audioUrl,
      model: MODEL,
      provider: "elevenlabs",
      requestId: "request_fixture",
    });
    expect(result.transcript).toEqual(data);
    expect(result.wordTimings).toEqual([data.words[0], data.words[2]]);
  });
  it("forwards an explicit language and diarization without coercing English", async () => {
    await transcribeScribe({ audio_url: audioUrl, language_code: "fra", diarize: true });
    expect(subscribe).toHaveBeenCalledWith(MODEL, {
      input: { audio_url: audioUrl, language_code: "fra", diarize: true, tag_audio_events: true },
    });
  });
  it.each([
    {},
    { audio_url: "invalid" },
    { audio_url: "file:///secret" },
    { audio_url: "https://name:password@example.invalid/a.wav" },
    { audio_url: audioUrl, model: "fal-ai/whisper" },
    { audio_url: audioUrl, audio_urls: [audioUrl] },
    { audio_url: audioUrl, keyterms: ["premium"] },
    { audio_url: audioUrl, account_id: "untrusted" },
  ])("rejects invalid/unsupported inputs before invoking provider: %j", async input => {
    await expect(transcribeScribe(input)).rejects.toThrow();
    expect(subscribe).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "   "])(
    "rejects a completed result without usable request id: %j",
    async requestId => {
      subscribe.mockResolvedValue({ requestId, data });
      await expect(transcribeScribe({ audio_url: audioUrl })).rejects.toThrow(
        "Scribe returned unusable word timings",
      );
      expect(subscribe).toHaveBeenCalledOnce();
    },
  );
  it("does not fall back or retry when the provider fails", async () => {
    subscribe.mockRejectedValue(new Error("provider private detail"));
    await expect(transcribeScribe({ audio_url: audioUrl })).rejects.toThrow(
      "Scribe transcription failed",
    );
    expect(subscribe).toHaveBeenCalledOnce();
  });
  it("retains the request identifier when paid output is malformed", async () => {
    subscribe.mockResolvedValue({
      requestId: "request_fixture",
      data: { text: "Hello", words: [] },
    });
    await expect(transcribeScribe({ audio_url: audioUrl })).rejects.toMatchObject({
      message: "Scribe returned unusable word timings",
      requestId: "request_fixture",
    });
    expect(subscribe).toHaveBeenCalledOnce();
  });
});
