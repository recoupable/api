import { describe, it, expect } from "vitest";
import { firstMeaningfulLine } from "../firstMeaningfulLine";

describe("firstMeaningfulLine", () => {
  it("returns the first non-empty line", () => {
    expect(firstMeaningfulLine("\n\nHello there\nmore")).toBe("Hello there");
  });

  it("strips a leading Markdown heading", () => {
    expect(firstMeaningfulLine("# Pulse Report\n\nbody")).toBe("Pulse Report");
    expect(firstMeaningfulLine("###  Deep heading")).toBe("Deep heading");
  });

  it("returns empty string for empty/undefined/whitespace input", () => {
    expect(firstMeaningfulLine()).toBe("");
    expect(firstMeaningfulLine("")).toBe("");
    expect(firstMeaningfulLine("   \n  \n")).toBe("");
  });
});
