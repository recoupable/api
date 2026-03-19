import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { gateway } from "@ai-sdk/gateway";
import { getAvailableModels } from "../getAvailableModels";

vi.mock("@ai-sdk/gateway", () => ({
  gateway: {
    getAvailableModels: vi.fn(),
  },
}));

const mockGatewayGetAvailableModels = vi.mocked(gateway.getAvailableModels);

describe("getAvailableModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetching models", () => {
    it("returns models from gateway excluding embed models", async () => {
      mockGatewayGetAvailableModels.mockResolvedValue({
        models: [
          { id: "gpt-4", pricing: { input: "0.00003", output: "0.00006" } },
          // Embed models have output price = 0
          { id: "text-embedding-ada-002", pricing: { input: "0.0001", output: "0" } },
          { id: "claude-3-opus", pricing: { input: "0.00001", output: "0.00003" } },
        ],
      } as any);

      const models = await getAvailableModels();

      // Should filter out embed models (output price = 0)
      expect(models).toHaveLength(2);
      expect(models.map(m => m.id)).toEqual(["gpt-4", "claude-3-opus"]);
    });

    it("returns empty array when gateway returns no models", async () => {
      mockGatewayGetAvailableModels.mockResolvedValue({ models: [] } as any);

      const models = await getAvailableModels();

      expect(models).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("returns empty array when gateway throws", async () => {
      mockGatewayGetAvailableModels.mockRejectedValue(new Error("API error"));

      const models = await getAvailableModels();

      expect(models).toEqual([]);
    });
  });
});
