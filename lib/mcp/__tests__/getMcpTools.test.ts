import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@ai-sdk/mcp", () => ({
  experimental_createMCPClient: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@/lib/networking/getBaseUrl", () => ({
  getBaseUrl: vi.fn().mockReturnValue("https://test.vercel.app"),
}));

import { getMcpTools } from "../getMcpTools";
import { experimental_createMCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const mockCreateMCPClient = vi.mocked(experimental_createMCPClient);
const mockStreamableHTTPClientTransport = vi.mocked(StreamableHTTPClientTransport);

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

  it("creates HTTP transport with correct URL", async () => {
    await getMcpTools("test-token");

    expect(mockStreamableHTTPClientTransport).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        requestInit: {
          headers: {
            Authorization: "Bearer test-token",
          },
        },
      }),
    );

    const urlArg = mockStreamableHTTPClientTransport.mock.calls[0][0] as URL;
    expect(urlArg.pathname).toBe("/api/mcp");
    expect(urlArg.origin).toBe("https://test.vercel.app");
  });

  it("creates MCP client with transport", async () => {
    await getMcpTools("test-token");

    expect(mockCreateMCPClient).toHaveBeenCalledWith({
      transport: expect.any(Object),
    });
  });

  it("returns tools from MCP client", async () => {
    const result = await getMcpTools("test-token");

    expect(result).toEqual(mockTools);
  });

  it("passes different auth tokens correctly", async () => {
    await getMcpTools("different-token");

    expect(mockStreamableHTTPClientTransport).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        requestInit: {
          headers: {
            Authorization: "Bearer different-token",
          },
        },
      }),
    );
  });
});
