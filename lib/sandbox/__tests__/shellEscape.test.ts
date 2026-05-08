import { describe, it, expect } from "vitest";
import { shellEscape } from "@/lib/sandbox/shellEscape";

describe("shellEscape", () => {
  it("wraps a plain string in single quotes", () => {
    expect(shellEscape("hello")).toBe("'hello'");
  });

  it("escapes embedded single quotes by closing/escaping/reopening", () => {
    expect(shellEscape("it's")).toBe("'it'\\''s'");
  });

  it("returns '' for an empty string", () => {
    expect(shellEscape("")).toBe("''");
  });

  it("preserves spaces and other shell metacharacters by quoting them", () => {
    expect(shellEscape("rm -rf /")).toBe("'rm -rf /'");
    expect(shellEscape("$HOME && echo")).toBe("'$HOME && echo'");
  });
});
