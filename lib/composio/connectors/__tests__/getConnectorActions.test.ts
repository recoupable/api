import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { getConnectorActions } from "../getConnectorActions";

import { getComposioTools } from "../../toolRouter/getTools";

vi.mock("../../toolRouter/getTools", () => ({
  getComposioTools: vi.fn(),
}));

describe("getConnectorActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return one ConnectorAction per merged tool, all marked isConnected: true", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      GOOGLEDRIVE_LIST_FILES: {
        description: "List files in a Google Drive folder",
        inputSchema: { type: "object", properties: { folderId: { type: "string" } } },
        execute: vi.fn(),
      },
      TIKTOK_POST_VIDEO: {
        description: "Post a video to TikTok",
        inputSchema: { type: "object", properties: { caption: { type: "string" } } },
        execute: vi.fn(),
      },
    });

    const result = await getConnectorActions("account-123");

    expect(getComposioTools).toHaveBeenCalledWith("account-123");
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          slug: "GOOGLEDRIVE_LIST_FILES",
          name: "GOOGLEDRIVE_LIST_FILES",
          description: "List files in a Google Drive folder",
          parameters: { type: "object", properties: { folderId: { type: "string" } } },
          connectorSlug: "googledrive",
          isConnected: true,
        },
        {
          slug: "TIKTOK_POST_VIDEO",
          name: "TIKTOK_POST_VIDEO",
          description: "Post a video to TikTok",
          parameters: { type: "object", properties: { caption: { type: "string" } } },
          connectorSlug: "tiktok",
          isConnected: true,
        },
      ]),
    );
  });

  it("should derive connectorSlug from the slug prefix", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      COMPOSIO_SEARCH_TOOLS: { description: "search", inputSchema: {}, execute: vi.fn() },
    });

    const result = await getConnectorActions("account-123");

    expect(result[0].connectorSlug).toBe("composio");
  });

  it("should default missing description to empty string", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      GOOGLEDRIVE_LIST_FILES: { inputSchema: { type: "object" }, execute: vi.fn() },
    });

    const result = await getConnectorActions("account-123");

    expect(result[0].description).toBe("");
  });

  it("should default missing inputSchema to empty object", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      GOOGLEDRIVE_LIST_FILES: { description: "list", execute: vi.fn() },
    });

    const result = await getConnectorActions("account-123");

    expect(result[0].parameters).toEqual({});
  });

  it("converts a Zod inputSchema into JSON Schema (no Zod internals leak)", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({
      GOOGLEDRIVE_LIST_FILES: {
        description: "list",
        inputSchema: z.object({ folderId: z.string().optional() }),
        execute: vi.fn(),
      },
    });

    const result = await getConnectorActions("account-123");

    expect(result[0].parameters).toEqual(
      expect.objectContaining({
        type: "object",
        properties: expect.objectContaining({
          folderId: expect.objectContaining({ type: "string" }),
        }),
      }),
    );
    expect(result[0].parameters).not.toHaveProperty("_def");
    expect(result[0].parameters).not.toHaveProperty("~standard");
  });

  it("returns empty array when getComposioTools returns empty object", async () => {
    vi.mocked(getComposioTools).mockResolvedValue({});

    const result = await getConnectorActions("account-123");

    expect(result).toEqual([]);
  });
});
