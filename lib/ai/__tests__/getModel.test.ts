import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getAvailableModels } from "@/lib/ai/getAvailableModels";
import { getModel } from "../getModel";

vi.mock("@/lib/ai/getAvailableModels", () => ({
  getAvailableModels: vi.fn(),
}));

const mockGetAvailableModels = vi.mocked(getAvailableModels);

describe("getModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("finding models", () => {
    it("returns the model when found by ID", async () => {
      const models = [
        { id: "gpt-4", pricing: { input: "0.00003", output: "0.00006" } },
        { id: "claude-3-opus", pricing: { input: "0.00001", output: "0.00003" } },
      ];
      mockGetAvailableModels.mockResolvedValue(models as any);

      const model = await getModel("gpt-4");

      expect(model).toEqual({
        id: "gpt-4",
        pricing: { input: "0.00003", output: "0.00006" },
      });
    });

    it("returns undefined when model is not found", async () => {
      const models = [{ id: "gpt-4", pricing: { input: "0.00003", output: "0.00006" } }];
      mockGetAvailableModels.mockResolvedValue(models as any);

      const model = await getModel("unknown-model");

      expect(model).toBeUndefined();
    });

    it("returns undefined when getAvailableModels returns empty array", async () => {
      mockGetAvailableModels.mockResolvedValue([]);

      const model = await getModel("gpt-4");

      expect(model).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("returns undefined when getAvailableModels throws", async () => {
      mockGetAvailableModels.mockRejectedValue(new Error("API error"));

      const model = await getModel("gpt-4");

      expect(model).toBeUndefined();
    });
  });
});
