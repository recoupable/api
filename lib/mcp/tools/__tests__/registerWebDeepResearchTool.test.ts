import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWebDeepResearchTool } from "../registerWebDeepResearchTool";

const mockChatWithPerplexity = vi.fn();

vi.mock("@/lib/perplexity/chatWithPerplexity", () => ({
  chatWithPerplexity: (...args: unknown[]) => mockChatWithPerplexity(...args),
}));

describe("registerWebDeepResearchTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown) => Promise<unknown>;
  let registeredConfig: { description: string; inputSchema: unknown };

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        registeredConfig = config;
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerWebDeepResearchTool(mockServer);
  });

  it("registers the web_deep_research tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "web_deep_research",
      expect.objectContaining({
        description: expect.stringContaining("Deep web research"),
      }),
      expect.any(Function),
    );
  });

  it("has correct input schema with messages array", () => {
    expect(registeredConfig.inputSchema).toBeDefined();
  });

  it("returns research results with content and citations", async () => {
    mockChatWithPerplexity.mockResolvedValue({
      content: "Research findings about the topic...",
      citations: ["https://example.com/source1", "https://example.com/source2"],
      searchResults: [
        { title: "Source 1", url: "https://example.com/source1" },
        { title: "Source 2", url: "https://example.com/source2" },
      ],
    });

    const result = await registeredHandler({
      messages: [{ role: "user", content: "Research this topic" }],
    });

    expect(mockChatWithPerplexity).toHaveBeenCalledWith(
      [{ role: "user", content: "Research this topic" }],
      "sonar-deep-research",
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Research findings about the topic"),
        },
      ],
    });
  });

  it("appends citations to the output", async () => {
    mockChatWithPerplexity.mockResolvedValue({
      content: "Research findings",
      citations: ["https://example.com/source1", "https://example.com/source2"],
      searchResults: [],
    });

    const result = (await registeredHandler({
      messages: [{ role: "user", content: "Research this topic" }],
    })) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0].text).toContain("Citations:");
    expect(result.content[0].text).toContain("[1] https://example.com/source1");
    expect(result.content[0].text).toContain("[2] https://example.com/source2");
  });

  it("handles empty messages array", async () => {
    const result = (await registeredHandler({
      messages: [],
    })) as { content: Array<{ type: string; text: string }> };

    // Error result contains JSON with message field
    expect(result.content[0].text).toContain("messages array is required");
  });

  it("returns error when chatWithPerplexity fails", async () => {
    mockChatWithPerplexity.mockRejectedValue(new Error("API rate limit exceeded"));

    const result = (await registeredHandler({
      messages: [{ role: "user", content: "Research this topic" }],
    })) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0].text).toContain("API rate limit exceeded");
  });

  it("uses sonar-deep-research model by default", async () => {
    mockChatWithPerplexity.mockResolvedValue({
      content: "Research findings",
      citations: [],
      searchResults: [],
    });

    await registeredHandler({
      messages: [{ role: "user", content: "Research this topic" }],
    });

    expect(mockChatWithPerplexity).toHaveBeenCalledWith(
      expect.any(Array),
      "sonar-deep-research",
    );
  });

  it("handles no citations gracefully", async () => {
    mockChatWithPerplexity.mockResolvedValue({
      content: "Research findings without citations",
      citations: [],
      searchResults: [],
    });

    const result = (await registeredHandler({
      messages: [{ role: "user", content: "Research this topic" }],
    })) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0].text).toContain("Research findings without citations");
    expect(result.content[0].text).not.toContain("Citations:");
  });
});
