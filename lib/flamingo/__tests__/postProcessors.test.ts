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
    const result = parseJsonLike("{'tags': ['dreamy', 'sad'], 'mood': 'melancholic'}");
    expect(result).toEqual({ tags: ["dreamy", "sad"], mood: "melancholic" });
  });

  it("preserves literal-looking words in quoted keys and nested text", () => {
    expect(
      parseJsonLike(
        "{'True': 'True Love', 'artist': 'Nonetheless', 'nested': [True, False, None, {'False None': 'Falsehood True None'}]}",
      ),
    ).toEqual({
      True: "True Love",
      artist: "Nonetheless",
      nested: [true, false, null, { "False None": "Falsehood True None" }],
    });
  });

  it("preserves double-quoted strings when another value requires Python literal normalization", () => {
    expect(
      parseJsonLike(
        String.raw`{"title": "Don't say \"True\"", "path": "C:\\None\\False", "ready": True}`,
      ),
    ).toEqual({ title: 'Don\'t say "True"', path: "C:\\None\\False", ready: true });
  });

  it("decodes supported escapes in single-quoted strings without changing their text", () => {
    expect(
      parseJsonLike(
        String.raw`{'title': 'Don\'t say "True"', 'path': 'C:\\None\\False', 'quote': '\"yes\"', 'controls': '\b\f\n\r\t', 'unicode': '\u00e9', 'slash': '\/'}`,
      ),
    ).toEqual({
      title: 'Don\'t say "True"',
      path: "C:\\None\\False",
      quote: '"yes"',
      controls: "\b\f\n\r\t",
      unicode: "é",
      slash: "/",
    });
  });

  it.each([
    String.raw`{"apostrophe":"don't", "backslash":"\\", "quote":"\"", "unicode":"\u263a"}`,
    '[true, false, null, -1.2e3, "True None False"]',
    '"standalone True"',
    "0",
    '{"same":1,"same":2}',
  ])("retains JSON.parse behavior for standard JSON: %s", raw => {
    expect(parseJsonLike(raw)).toEqual(JSON.parse(raw));
  });

  it.each([
    "{'title': 'don't'}",
    "{'title': 'unterminated}",
    "{'x': TrueFalse}",
    "{'x': Nonetheless}",
    "{'x': None_}",
    "{'x': 'a' 'b'}",
    "{'x': True,}",
    "{'x': (True, False)}",
    "{'x': set()}",
    "{'x': b'text'}",
    "{'x': 0x10}",
    "{'x': NaN}",
    "{'x': True # comment\n}",
    String.raw`{'x': '\x41'}`,
    String.raw`{'x': '\q'}`,
    String.raw`{'x': '\123'}`,
    String.raw`{'x': '\u12'}`,
    "{'x': 'line\nbreak'}",
    "{'x': 'trailing\\",
  ])("rejects malformed or unsupported syntax: %s", raw => {
    expect(() => parseJsonLike(raw)).toThrow();
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
    const result = condenseRepetitions("Ah, oh, oh, oh, oh, oh, yeah");
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
