import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAvailableModelsHandler } from "@/lib/ai/getAvailableModelsHandler";
import { getAvailableModels } from "@/lib/ai/getAvailableModels";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/ai/getAvailableModels", () => ({
  getAvailableModels: vi.fn(),
}));

describe("getAvailableModelsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { models } on success", async () => {
    const models = [
      { id: "openai/gpt-4o", name: "GPT-4o" },
      { id: "anthropic/claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
    ];

    vi.mocked(getAvailableModels).mockResolvedValue(models as any);

    const response = await getAvailableModelsHandler();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ models });
  });

  it("returns 500 with generic message when underlying call throws (no raw error leak)", async () => {
    vi.mocked(getAvailableModels).mockRejectedValue(new Error("gateway down"));

    const response = await getAvailableModelsHandler();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ message: "Internal server error" });
    expect(body.message).not.toContain("gateway down");
  });

  it("returns 500 with generic message when error is not an Error instance", async () => {
    vi.mocked(getAvailableModels).mockRejectedValue("kaboom");

    const response = await getAvailableModelsHandler();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ message: "Internal server error" });
  });
});
