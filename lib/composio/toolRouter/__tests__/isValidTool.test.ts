import { describe, it, expect, vi } from "vitest";
import { isValidTool } from "../isValidTool";

describe("isValidTool", () => {
  it("accepts a Composio-shaped tool with inputSchema + execute", () => {
    expect(
      isValidTool({
        description: "ok",
        inputSchema: { type: "object" },
        execute: vi.fn(),
      }),
    ).toBe(true);
  });

  it("accepts a Vercel-AI-SDK tool with parameters + execute", () => {
    expect(
      isValidTool({
        description: "ok",
        parameters: { type: "object" },
        execute: vi.fn(),
      }),
    ).toBe(true);
  });

  it("rejects when execute is missing", () => {
    expect(isValidTool({ description: "no exec", inputSchema: {} })).toBe(false);
  });

  it("rejects when both parameters and inputSchema are missing", () => {
    expect(isValidTool({ description: "no schema", execute: vi.fn() })).toBe(false);
  });

  it("rejects non-object inputs", () => {
    expect(isValidTool(null)).toBe(false);
    expect(isValidTool(undefined)).toBe(false);
    expect(isValidTool("string")).toBe(false);
    expect(isValidTool(42)).toBe(false);
  });
});
