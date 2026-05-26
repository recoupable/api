import { describe, it, expect } from "vitest";
import { toKebabCase } from "@/lib/string/toKebabCase";

describe("toKebabCase", () => {
  it("lowercases input", () => {
    expect(toKebabCase("Hello")).toBe("hello");
  });

  it("replaces dots with single hyphen — guards the sweetman.eth -> sweetman-eth bug from chat", () => {
    expect(toKebabCase("sweetman.eth")).toBe("sweetman-eth");
  });

  it("collapses runs of non-alphanumerics into a single hyphen", () => {
    expect(toKebabCase("Foo   Bar___Baz")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing hyphens", () => {
    expect(toKebabCase("---foo bar---")).toBe("foo-bar");
  });

  it("preserves digits", () => {
    expect(toKebabCase("Artist 42")).toBe("artist-42");
  });

  it("returns empty string for all-symbol input", () => {
    expect(toKebabCase("@@@")).toBe("");
  });
});
