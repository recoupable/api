import { describe, it, expect } from "vitest";
import { isAgentContext } from "@/lib/agent/tools/isAgentContext";

describe("isAgentContext", () => {
  it("returns true for a well-formed context", () => {
    expect(
      isAgentContext({
        sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" },
      }),
    ).toBe(true);
  });

  it("returns false for non-object inputs", () => {
    expect(isAgentContext(undefined)).toBe(false);
    expect(isAgentContext(null)).toBe(false);
    expect(isAgentContext("nope")).toBe(false);
    expect(isAgentContext(42)).toBe(false);
  });

  it("returns false when sandbox is missing", () => {
    expect(isAgentContext({})).toBe(false);
  });

  it("returns false when sandbox is null", () => {
    expect(isAgentContext({ sandbox: null })).toBe(false);
  });

  it("returns false when sandbox is empty (missing state and workingDirectory)", () => {
    expect(isAgentContext({ sandbox: {} })).toBe(false);
  });

  it("returns false when sandbox.state is missing or null", () => {
    expect(isAgentContext({ sandbox: { workingDirectory: "/x" } })).toBe(false);
    expect(isAgentContext({ sandbox: { state: null, workingDirectory: "/x" } })).toBe(false);
  });

  it("returns false when sandbox.workingDirectory is missing, non-string, or empty", () => {
    expect(isAgentContext({ sandbox: { state: {} } })).toBe(false);
    expect(isAgentContext({ sandbox: { state: {}, workingDirectory: 42 } })).toBe(false);
    expect(isAgentContext({ sandbox: { state: {}, workingDirectory: "" } })).toBe(false);
  });
});
