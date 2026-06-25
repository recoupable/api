import { describe, it, expect } from "vitest";
import { stripHtml } from "../stripHtml";

describe("stripHtml", () => {
  it("strips tags and breaks blocks onto their own lines", () => {
    expect(stripHtml("<h1>Launch day</h1><p>details</p>")).toBe("Launch day\n details");
  });

  it("turns <br> into a newline", () => {
    expect(stripHtml("line one<br/>line two")).toBe("line one\nline two");
  });

  it("collapses runs of spaces/tabs and trims", () => {
    expect(stripHtml("<span>  a\t\t b </span>")).toBe("a b");
  });

  it("returns empty string for empty/undefined input", () => {
    expect(stripHtml()).toBe("");
    expect(stripHtml("")).toBe("");
  });
});
