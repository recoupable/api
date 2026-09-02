import { describe, it, expect } from "vitest";
import { parseDurationSeconds } from "@/lib/content/parseDurationSeconds";

describe("parseDurationSeconds", () => {
  it("parses the documented enum values", () => {
    expect(parseDurationSeconds("4s")).toBe(4);
    expect(parseDurationSeconds("8s")).toBe(8);
  });

  it("is zero for missing or unparseable input", () => {
    expect(parseDurationSeconds(undefined)).toBe(0);
    expect(parseDurationSeconds("")).toBe(0);
    expect(parseDurationSeconds("auto")).toBe(0);
  });
});
