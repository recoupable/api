import { describe, it, expect } from "vitest";
import { parseModelsDevMetadata } from "@/lib/ai/parseModelsDevMetadata";

describe("parseModelsDevMetadata", () => {
  it("returns an empty map when input is not a record", () => {
    expect(parseModelsDevMetadata(null)).toEqual(new Map());
    expect(parseModelsDevMetadata("nope")).toEqual(new Map());
    expect(parseModelsDevMetadata(123)).toEqual(new Map());
    expect(parseModelsDevMetadata([])).toEqual(new Map());
  });

  it("extracts context_window and cost from a well-formed entry", () => {
    const result = parseModelsDevMetadata({
      anthropic: {
        models: {
          "claude-3-opus": {
            id: "claude-3-opus",
            limit: { context: 200000 },
            cost: { input: 15, output: 75 },
          },
        },
      },
    });

    expect(result.get("anthropic/claude-3-opus")).toEqual({
      context_window: 200000,
      cost: { input: 15, output: 75 },
    });
  });

  it("respects an already-namespaced id without double-prefixing", () => {
    const result = parseModelsDevMetadata({
      openai: {
        models: {
          "gpt-4o": {
            id: "openai/gpt-4o",
            limit: { context: 128000 },
          },
        },
      },
    });

    expect(result.has("openai/gpt-4o")).toBe(true);
    expect(result.has("openai/openai/gpt-4o")).toBe(false);
  });

  it("falls back to the model key when id is missing or non-string", () => {
    const result = parseModelsDevMetadata({
      acme: {
        models: {
          "fancy-model": {
            limit: { context: 8192 },
          },
        },
      },
    });
    expect(result.get("acme/fancy-model")?.context_window).toBe(8192);
  });

  it("skips entries with neither context_window nor cost", () => {
    const result = parseModelsDevMetadata({
      acme: { models: { ghost: { id: "ghost", limit: {} } } },
    });
    expect(result.has("acme/ghost")).toBe(false);
  });

  it("skips cost when input or output is missing", () => {
    const result = parseModelsDevMetadata({
      acme: {
        models: {
          partial: {
            id: "partial",
            limit: { context: 100 },
            cost: { input: 1 },
          },
        },
      },
    });
    expect(result.get("acme/partial")).toEqual({ context_window: 100 });
  });

  it("skips non-positive context_window values", () => {
    const result = parseModelsDevMetadata({
      acme: {
        models: {
          weird: {
            id: "weird",
            limit: { context: 0 },
            cost: { input: 1, output: 2 },
          },
        },
      },
    });
    expect(result.get("acme/weird")).toEqual({ cost: { input: 1, output: 2 } });
  });

  it("ignores providers and models that aren't records", () => {
    const result = parseModelsDevMetadata({
      anthropic: "not-a-record",
      openai: { models: "also-broken" },
      cohere: { models: { "good-model": { id: "good", limit: { context: 1 } } } },
    });
    expect(result.size).toBe(1);
    expect(result.has("cohere/good")).toBe(true);
  });
});
