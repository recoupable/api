import { describe, it, expect, vi, beforeEach } from "vitest";

import { gateway } from "@ai-sdk/gateway";
import { getAvailableModels } from "../getAvailableModels";

vi.mock("@ai-sdk/gateway", () => ({
  gateway: { getAvailableModels: vi.fn() },
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

    const models = await getAvailableModels();

    expect(models.map(m => m.id)).toEqual(["gpt-4", "claude-3-opus"]);
  });

  it("returns empty array when gateway returns no models", async () => {
    vi.mocked(gateway.getAvailableModels).mockResolvedValue({ models: [] } as Awaited<
      ReturnType<typeof gateway.getAvailableModels>
    >);

    expect(await getAvailableModels()).toEqual([]);
  });

  it("returns empty array when gateway throws", async () => {
    vi.mocked(gateway.getAvailableModels).mockRejectedValue(new Error("kaboom"));

    expect(await getAvailableModels()).toEqual([]);
  });
});
