import { describe, it, expect, vi } from "vitest";
import { pickValid } from "../pickValid";

const makeTool = () => ({
  description: "mock",
  inputSchema: {},
  execute: vi.fn(),
});

describe("pickValid", () => {
  it("returns only entries whose name passes the filter", () => {
    const tools = {
      KEEP_ONE: makeTool(),
      DROP_ONE: makeTool(),
      KEEP_TWO: makeTool(),
    };

    const out = pickValid(tools, name => name.startsWith("KEEP_"));

    expect(Object.keys(out).sort()).toEqual(["KEEP_ONE", "KEEP_TWO"]);
  });

  it("drops entries that pass the filter but fail shape validation", () => {
    const tools = {
      VALID: makeTool(),
      INVALID: { description: "no execute" },
    };

    const out = pickValid(tools, () => true);

    expect(out).toHaveProperty("VALID");
    expect(out).not.toHaveProperty("INVALID");
  });

  it("returns an empty object when no tools match", () => {
    expect(pickValid({}, () => true)).toEqual({});
    expect(pickValid({ A: makeTool() }, () => false)).toEqual({});
  });
});
