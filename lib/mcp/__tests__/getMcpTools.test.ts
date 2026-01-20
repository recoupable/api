import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@ai-sdk/mcp", () => ({
  experimental_createMCPClient: vi.fn(),
}));

vi.mock("@/lib/networking/getBaseUrl", () => ({
  getBaseUrl: vi.fn().mockReturnValue("https://test.vercel.app"),
}));

import { getMcpTools } from "../getMcpTools";
import { experimental_createMCPClient } from "@ai-sdk/mcp";

const mockCreateMCPClient = vi.mocked(experimental_createMCPClient);

describe("getMcpTools", () => {
  const mockTools = {
    tool1: { description: "Tool 1", parameters: {} },
    tool2: { description: "Tool 2", parameters: {} },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateMCPClient.mockResolvedValue({
      tools: vi.fn().mockResolvedValue(mockTools),
    } as any);
  });

  it("creates MCP client with HTTP transport config", async () => {
    await getMcpTools("test-token");

    expect(mockCreateMCPClient).toHaveBeenCalledWith({
      transport: {
        type: "http",
        url: "https://test.vercel.app/mcp",
        headers: {
          Authorization: "Bearer test-token",
        },
      },
    });
  });

  it("returns tools from MCP client", async () => {
    const result = await getMcpTools("test-token");

    expect(result).toEqual(mockTools);
  });

  it("passes different auth tokens correctly", async () => {
    await getMcpTools("different-token");

    expect(mockCreateMCPClient).toHaveBeenCalledWith({
      transport: {
        type: "http",
        url: "https://test.vercel.app/mcp",
        headers: {
          Authorization: "Bearer different-token",
        },
      },
    });
  });
});
