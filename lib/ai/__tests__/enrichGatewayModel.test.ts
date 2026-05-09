import { describe, it, expect } from "vitest";
import { enrichGatewayModel } from "@/lib/ai/enrichGatewayModel";

describe("enrichGatewayModel", () => {
  it("returns the original model when the metadata map has no matching entry", () => {
    const model = { id: "x/y", name: "X" };
    const result = enrichGatewayModel(model, new Map());
    expect(result).toEqual(model);
  });

  it("merges context_window when present in metadata", () => {
    const model = { id: "x/y", name: "X" };
    const map = new Map([["x/y", { context_window: 4096 }]]);
    expect(enrichGatewayModel(model, map)).toEqual({
      id: "x/y",
      name: "X",
      context_window: 4096,
    });
  });

  it("merges cost when present in metadata", () => {
    const model = { id: "x/y", name: "X" };
    const map = new Map([["x/y", { cost: { input: 1, output: 2 } }]]);
    expect(enrichGatewayModel(model, map)).toEqual({
      id: "x/y",
      name: "X",
      cost: { input: 1, output: 2 },
    });
  });

  it("does not mutate the original model", () => {
    const model = { id: "x/y", name: "X" } as Record<string, unknown>;
    const map = new Map([["x/y", { context_window: 100 }]]);
    enrichGatewayModel(model, map);
    expect(model.context_window).toBeUndefined();
  });
});
