import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getAvailableModels } from "../getAvailableModels";

describe("getAvailableModels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns models from gateway excluding embed models", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { id: "gpt-4", pricing: { input: "0.00003", output: "0.00006" } },
          { id: "text-embedding-ada-002", pricing: { input: "0.0001", output: "0" } },
          { id: "claude-3-opus", pricing: { input: "0.00001", output: "0.00003" } },
        ],
      }),
    } as Response);

    const models = await getAvailableModels();

    expect(models).toHaveLength(2);
    expect(models.map(m => m.id)).toEqual(["gpt-4", "claude-3-opus"]);
  });

  it("returns empty array when gateway returns no models", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ models: [] }),
    } as Response);

    expect(await getAvailableModels()).toEqual([]);
  });

  it("returns empty array on non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);

    expect(await getAvailableModels()).toEqual([]);
  });

  it("returns empty array when fetch throws", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    expect(await getAvailableModels()).toEqual([]);
  });
});
