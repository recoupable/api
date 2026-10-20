import { describe, expect, it } from "vitest";
import { parseScribeResult } from "../parseScribeResult";
const word = { type: "word", text: "Hello", start: 0, end: 0.5 };
const transcript = { text: "Hello", language_code: "eng", language_probability: 1, words: [word] };
describe("Scribe word timing validation", () => {
  it("accepts actual zero start without fabricating timestamps", () => {
    expect(parseScribeResult(transcript)).toEqual(transcript);
  });
  it("preserves nullable speaker IDs and null non-word timestamps from the provider schema", () => {
    const input = {
      ...transcript,
      words: [
        { ...word, speaker_id: null },
        { type: "spacing", text: " ", start: null, end: null, speaker_id: null },
        { type: "audio_event", text: "[music]", start: null, end: null, speaker_id: null },
      ],
    };
    expect(parseScribeResult(input)).toEqual(input);
  });
  it.each([
    { start: null },
    { end: null },
    { start: undefined },
    { end: undefined },
    { start: -1 },
    { end: -1 },
    { start: NaN },
    { end: Infinity },
    { start: 2, end: 1 },
    { text: " " },
    { type: "unexpected" },
  ])("rejects unusable word timing: %j", changes => {
    expect(() => parseScribeResult({ ...transcript, words: [{ ...word, ...changes }] })).toThrow();
  });
  it.each([
    { words: word },
    { words: [] },
    { words: [{ type: "audio_event", text: "[music]" }] },
    { text: undefined },
    { language_probability: 2 },
  ])("rejects malformed output or output without any timed words: %j", changes => {
    expect(() => parseScribeResult({ ...transcript, ...changes })).toThrow();
  });
});
