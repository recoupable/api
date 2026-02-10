import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchGoogleImagesTool } from "../registerSearchGoogleImagesTool";

const mockSearchGoogleImages = vi.fn();

vi.mock("@/lib/serpapi/searchGoogleImages", () => ({
  searchGoogleImages: (...args: unknown[]) => mockSearchGoogleImages(...args),
}));

describe("registerSearchGoogleImagesTool", () => {
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

    registerSearchGoogleImagesTool(mockServer);
  });

  it("registers the search_google_images tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "search_google_images",
      expect.objectContaining({
        description: expect.stringContaining("Search for EXISTING images"),
      }),
      expect.any(Function),
    );
  });

  it("has correct input schema", () => {
    expect(registeredConfig.inputSchema).toBeDefined();
  });

  it("returns image results on successful search", async () => {
    mockSearchGoogleImages.mockResolvedValue({
      images_results: [
        {
          position: 1,
          thumbnail: "https://example.com/thumb1.jpg",
          original: "https://example.com/full1.jpg",
          original_width: 1920,
          original_height: 1080,
          title: "Mac Miller Concert",
          source: "example.com",
          link: "https://example.com/page1",
        },
        {
          position: 2,
          thumbnail: "https://example.com/thumb2.jpg",
          original: "https://example.com/full2.jpg",
          original_width: 800,
          original_height: 600,
          title: "Mac Miller Album",
          source: "music.com",
          link: "https://music.com/page2",
        },
      ],
    });

    const result = (await registeredHandler({
      query: "Mac Miller concert",
      limit: 8,
    })) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.success).toBe(true);
    expect(parsed.query).toBe("Mac Miller concert");
    expect(parsed.total_results).toBe(2);
    expect(parsed.images).toHaveLength(2);
    expect(parsed.images[0]).toEqual({
      position: 1,
      thumbnail: "https://example.com/thumb1.jpg",
      original: "https://example.com/full1.jpg",
      width: 1920,
      height: 1080,
      title: "Mac Miller Concert",
      source: "example.com",
      link: "https://example.com/page1",
    });
  });

  it("passes search options to searchGoogleImages", async () => {
    mockSearchGoogleImages.mockResolvedValue({ images_results: [] });

    await registeredHandler({
      query: "album covers",
      limit: 5,
      imageSize: "l",
      imageType: "photo",
      aspectRatio: "wide",
    });

    expect(mockSearchGoogleImages).toHaveBeenCalledWith({
      query: "album covers",
      limit: 5,
      imageSize: "l",
      imageType: "photo",
      aspectRatio: "wide",
    });
  });

  it("uses default limit of 8 when not specified", async () => {
    mockSearchGoogleImages.mockResolvedValue({ images_results: [] });

    await registeredHandler({ query: "test" });

    expect(mockSearchGoogleImages).toHaveBeenCalledWith(expect.objectContaining({ limit: 8 }));
  });

  it("handles empty images_results gracefully", async () => {
    mockSearchGoogleImages.mockResolvedValue({ images_results: [] });

    const result = (await registeredHandler({
      query: "nonexistent thing",
    })) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.success).toBe(true);
    expect(parsed.total_results).toBe(0);
    expect(parsed.images).toHaveLength(0);
  });

  it("handles undefined images_results gracefully", async () => {
    mockSearchGoogleImages.mockResolvedValue({});

    const result = (await registeredHandler({
      query: "nonexistent thing",
    })) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.success).toBe(true);
    expect(parsed.total_results).toBe(0);
    expect(parsed.images).toHaveLength(0);
  });

  it("returns error when searchGoogleImages fails", async () => {
    mockSearchGoogleImages.mockRejectedValue(new Error("SerpAPI request failed: 403"));

    const result = (await registeredHandler({
      query: "Mac Miller",
    })) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain("SerpAPI request failed: 403");
  });

  it("returns generic error message for non-Error exceptions", async () => {
    mockSearchGoogleImages.mockRejectedValue("unexpected string error");

    const result = (await registeredHandler({
      query: "Mac Miller",
    })) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain("Failed to search Google Images");
  });
});
