import { describe, expect, it } from "vitest";
import { parseScribeResult } from "../parseScribeResult";
const word = { type: "word", text: "Hello", start: 0, end: 0.5 };
const transcript = { text: "Hello", language_code: "eng", language_probability: 1, words: [word] };
describe("Scribe word timing validation", () => {
  it("accepts actual zero start without fabricating timestamps", () => {
    expect(parseScribeResult(transcript)).toEqual(transcript);
  });
  it.each([
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
