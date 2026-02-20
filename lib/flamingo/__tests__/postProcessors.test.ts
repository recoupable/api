import { describe, it, expect } from "vitest";
import {
  parseJsonLike,
  condenseRepetitions,
  extractOneCycle,
  deduplicateArray,
} from "../presets/postProcessors";

describe("parseJsonLike", () => {
  it("parses valid JSON with double quotes", () => {
    const result = parseJsonLike('{"genre": "pop", "bpm": 120}');
    expect(result).toEqual({ genre: "pop", bpm: 120 });
  });

  it("parses Python-style single-quoted dict", () => {
    const result = parseJsonLike("{'genre': 'pop', 'bpm': 120}");
    expect(result).toEqual({ genre: "pop", bpm: 120 });
  });

  it("handles Python True/False/None", () => {
    const result = parseJsonLike("{'explicit': False, 'data': None}");
    expect(result).toEqual({ explicit: false, data: null });
  });

  it("handles nested objects with single quotes", () => {
    const result = parseJsonLike(
      "{'tags': ['dreamy', 'sad'], 'mood': 'melancholic'}",
    );
    expect(result).toEqual({ tags: ["dreamy", "sad"], mood: "melancholic" });
  });

  it("throws on invalid input", () => {
    expect(() => parseJsonLike("not json at all")).toThrow();
  });
});

describe("condenseRepetitions", () => {
  it("condenses 3+ repeated tokens", () => {
    const result = condenseRepetitions("oh, oh, oh, oh, oh");
    expect(result).toBe("(oh x5)");
  });

  it("leaves non-repeated tokens alone", () => {
    const result = condenseRepetitions("hello, world, foo");
    expect(result).toBe("hello, world, foo");
  });

  it("condenses within larger text", () => {
    const result = condenseRepetitions(
      "Ah, oh, oh, oh, oh, oh, yeah",
    );
    expect(result).toBe("Ah, (oh x5), yeah");
  });

  it("handles two separate repetition groups", () => {
    const result = condenseRepetitions("oh, oh, oh, la, la, la, la");
    expect(result).toBe("(oh x3), (la x4)");
  });

  it("does not condense runs shorter than minRepeats", () => {
    const result = condenseRepetitions("oh, oh, yeah", 3);
    expect(result).toBe("oh, oh, yeah");
  });
});

describe("extractOneCycle", () => {
  it("extracts one cycle from a repeating pattern", () => {
    const result = extractOneCycle(["C", "G", "Am", "F", "C", "G", "Am", "F"]);
    expect(result).toEqual(["C", "G", "Am", "F"]);
  });

  it("extracts two-chord cycle", () => {
    const result = extractOneCycle(["C", "G", "C", "G", "C", "G"]);
    expect(result).toEqual(["C", "G"]);
  });

  it("returns original array if no pattern found", () => {
    const result = extractOneCycle(["C", "G", "Am", "F", "Dm"]);
    expect(result).toEqual(["C", "G", "Am", "F", "Dm"]);
  });

  it("returns original for single-element array", () => {
    const result = extractOneCycle(["C"]);
    expect(result).toEqual(["C"]);
  });

  it("returns original for empty array", () => {
    const result = extractOneCycle([]);
    expect(result).toEqual([]);
  });
});

describe("deduplicateArray", () => {
  it("removes duplicate strings", () => {
    const result = deduplicateArray(["pop", "rock", "pop", "jazz", "rock"]);
    expect(result).toEqual(["pop", "rock", "jazz"]);
  });

  it("preserves order of first occurrence", () => {
    const result = deduplicateArray(["c", "a", "b", "a", "c"]);
    expect(result).toEqual(["c", "a", "b"]);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateArray([])).toEqual([]);
  });
});
