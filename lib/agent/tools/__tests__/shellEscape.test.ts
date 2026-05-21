import { describe, it, expect } from "vitest";
import { shellEscape } from "@/lib/agent/tools/shellEscape";

describe("shellEscape", () => {
  it("wraps a plain string in single quotes", () => {
    expect(shellEscape("hello")).toBe("'hello'");
  });

  it("escapes embedded single quotes via the standard ' → '\\'' dance", () => {
    expect(shellEscape("it's")).toBe("'it'\\''s'");
  });

  it("handles strings with shell metacharacters unchanged inside single quotes", () => {
    expect(shellEscape("$VAR `cmd` && rm -rf /")).toBe("'$VAR `cmd` && rm -rf /'");
  });

  it("returns just '' for the empty string", () => {
    expect(shellEscape("")).toBe("''");
  });
});
