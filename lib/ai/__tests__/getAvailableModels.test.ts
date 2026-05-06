import { describe, it, expect, vi, beforeEach } from "vitest";

import { gateway } from "@ai-sdk/gateway";
import { getAvailableModels } from "../getAvailableModels";
import { fetchModelsDevMetadata } from "@/lib/ai/fetchModelsDevMetadata";

vi.mock("@ai-sdk/gateway", () => ({
  gateway: { getAvailableModels: vi.fn() },
}));

vi.mock("@/lib/ai/fetchModelsDevMetadata", () => ({
  fetchModelsDevMetadata: vi.fn(),
}));

describe("getAvailableModels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns models from gateway excluding embed models", async () => {
    vi.mocked(gateway.getAvailableModels).mockResolvedValue({
      models: [
        { id: "gpt-4", pricing: { input: "0.00003", output: "0.00006" } },
        { id: "text-embedding-ada-002", pricing: { input: "0.0001", output: "0" } },
        { id: "claude-3-opus", pricing: { input: "0.00001", output: "0.00003" } },
      ],
    } as Awaited<ReturnType<typeof gateway.getAvailableModels>>);
    vi.mocked(fetchModelsDevMetadata).mockResolvedValue(new Map());

    const models = await getAvailableModels();

    expect(models.map(m => m.id)).toEqual(["gpt-4", "claude-3-opus"]);
  });

  it("enriches models with context_window + cost when metadata is available", async () => {
    vi.mocked(gateway.getAvailableModels).mockResolvedValue({
      models: [
        {
          id: "anthropic/claude-3-5-sonnet",
          pricing: { input: "0.000003", output: "0.000015" },
        },
      ],
    } as Awaited<ReturnType<typeof gateway.getAvailableModels>>);
    vi.mocked(fetchModelsDevMetadata).mockResolvedValue(
      new Map([
        ["anthropic/claude-3-5-sonnet", { context_window: 200000, cost: { input: 3, output: 15 } }],
      ]),
    );

    const [model] = await getAvailableModels();
    expect((model as { context_window?: number }).context_window).toBe(200000);
    expect((model as { cost?: { input: number; output: number } }).cost).toEqual({
      input: 3,
      output: 15,
    });
  });

  it("returns gateway models unchanged when metadata fetch returns an empty map", async () => {
    vi.mocked(gateway.getAvailableModels).mockResolvedValue({
      models: [{ id: "gpt-4", pricing: { input: "0.00003", output: "0.00006" } }],
    } as Awaited<ReturnType<typeof gateway.getAvailableModels>>);
    vi.mocked(fetchModelsDevMetadata).mockResolvedValue(new Map());

    const [model] = await getAvailableModels();
    expect((model as { context_window?: number }).context_window).toBeUndefined();
    expect((model as { cost?: unknown }).cost).toBeUndefined();
  });

  it("returns empty array when gateway returns no models", async () => {
    vi.mocked(gateway.getAvailableModels).mockResolvedValue({ models: [] } as Awaited<
      ReturnType<typeof gateway.getAvailableModels>
    >);
    vi.mocked(fetchModelsDevMetadata).mockResolvedValue(new Map());

    expect(await getAvailableModels()).toEqual([]);
  });

  it("returns empty array when gateway throws", async () => {
    vi.mocked(gateway.getAvailableModels).mockRejectedValue(new Error("kaboom"));
    vi.mocked(fetchModelsDevMetadata).mockResolvedValue(new Map());

    expect(await getAvailableModels()).toEqual([]);
  });
});
