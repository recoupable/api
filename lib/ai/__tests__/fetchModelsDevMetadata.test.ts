import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchModelsDevMetadata } from "@/lib/ai/fetchModelsDevMetadata";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchModelsDevMetadata", () => {
  it("returns the parsed metadata map on a 200 response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        anthropic: {
          models: {
            "claude-3-5-sonnet": {
              id: "claude-3-5-sonnet",
              limit: { context: 200000 },
              cost: { input: 3, output: 15 },
            },
          },
        },
      }),
    });

    const result = await fetchModelsDevMetadata();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://models.dev/api.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.get("anthropic/claude-3-5-sonnet")).toEqual({
      context_window: 200000,
      cost: { input: 3, output: 15 },
    });
  });

  it("returns an empty map when the response is non-200", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await fetchModelsDevMetadata()).toEqual(new Map());
  });

  it("returns an empty map when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    expect(await fetchModelsDevMetadata()).toEqual(new Map());
  });

  it("returns an empty map when JSON parsing throws", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("not json");
      },
    });
    expect(await fetchModelsDevMetadata()).toEqual(new Map());
  });
});
