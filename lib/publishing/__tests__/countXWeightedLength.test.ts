import { describe, it, expect } from "vitest";
import { countXWeightedLength } from "../countXWeightedLength";

describe("countXWeightedLength", () => {
  it("counts Latin text one per character", () => {
    expect(countXWeightedLength("The NFL Draft added 780K streams.")).toBe(33);
  });

  it("counts any URL as 23, with or without a scheme", () => {
    expect(countXWeightedLength("https://recoupable.dev/podcast?utm_source=x")).toBe(23);
    expect(countXWeightedLength("see recoupable.dev/podcast")).toBe(4 + 23);
  });

  it("counts CJK characters and emoji as 2", () => {
    expect(countXWeightedLength("音楽")).toBe(4);
    expect(countXWeightedLength("🎵")).toBe(2);
    expect(countXWeightedLength("👩‍🎤")).toBe(2);
  });

  it("puts 280 Latin characters exactly at the limit", () => {
    expect(countXWeightedLength("a".repeat(280))).toBe(280);
  });
});
