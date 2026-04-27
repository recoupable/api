import { describe, it, expect, vi, beforeEach } from "vitest";
import { getConnectorActions } from "../getConnectorActions";

import { getComposioClient } from "../../client";

vi.mock("../../client", () => ({
  getComposioClient: vi.fn(),
}));

describe("getConnectorActions", () => {
  const mockToolkits = vi.fn();
  const mockTools = vi.fn();
  const mockSession = { toolkits: mockToolkits, tools: mockTools };
  const mockComposio = { create: vi.fn(() => mockSession) };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getComposioClient).mockResolvedValue(mockComposio);
  });

  it("should return actions with isConnected derived from parent toolkit", async () => {
    mockToolkits.mockResolvedValue({
      items: [
        { slug: "googlesheets", name: "Google Sheets", connection: { isActive: true } },
        { slug: "tiktok", name: "TikTok", connection: null },
      ],
    });
    mockTools.mockResolvedValue({
      GOOGLESHEETS_WRITE_SPREADSHEET: {
        description: "Write rows to a Google Sheet",
        inputSchema: { type: "object", properties: { sheetId: { type: "string" } } },
      },
      TIKTOK_POST_VIDEO: {
        description: "Post a video to TikTok",
        inputSchema: { type: "object", properties: { caption: { type: "string" } } },
      },
    });

    const result = await getConnectorActions("account-123");

    expect(getComposioClient).toHaveBeenCalled();
    expect(mockComposio.create).toHaveBeenCalledWith(
      "account-123",
      expect.objectContaining({
        toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok", "instagram"],
      }),
    );
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          slug: "GOOGLESHEETS_WRITE_SPREADSHEET",
          name: "GOOGLESHEETS_WRITE_SPREADSHEET",
          description: "Write rows to a Google Sheet",
          parameters: { type: "object", properties: { sheetId: { type: "string" } } },
          connectorSlug: "googlesheets",
          isConnected: true,
        },
        {
          slug: "TIKTOK_POST_VIDEO",
          name: "TIKTOK_POST_VIDEO",
          description: "Post a video to TikTok",
          parameters: { type: "object", properties: { caption: { type: "string" } } },
          connectorSlug: "tiktok",
          isConnected: false,
        },
      ]),
    );
  });

  it("should default isConnected to false for unknown toolkit prefixes", async () => {
    mockToolkits.mockResolvedValue({ items: [] });
    mockTools.mockResolvedValue({
      MYSTERY_DO_THING: {
        description: "Unknown toolkit",
        inputSchema: { type: "object" },
      },
    });

    const result = await getConnectorActions("account-123");

    expect(result).toHaveLength(1);
    expect(result[0].isConnected).toBe(false);
    expect(result[0].connectorSlug).toBe("mystery");
  });

  it("should default missing description to empty string", async () => {
    mockToolkits.mockResolvedValue({ items: [] });
    mockTools.mockResolvedValue({
      GMAIL_FETCH_EMAILS: { inputSchema: { type: "object" } },
    });

    const result = await getConnectorActions("account-123");

    expect(result[0].description).toBe("");
  });

  it("should default missing inputSchema to empty object", async () => {
    mockToolkits.mockResolvedValue({ items: [] });
    mockTools.mockResolvedValue({
      GMAIL_FETCH_EMAILS: { description: "fetch" },
    });

    const result = await getConnectorActions("account-123");

    expect(result[0].parameters).toEqual({});
  });

  it("should pass authConfigs when env vars set", async () => {
    const orig = process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
    process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID = "ac_tiktok_xyz";

    try {
      mockToolkits.mockResolvedValue({ items: [] });
      mockTools.mockResolvedValue({});

      await getConnectorActions("account-123");

      expect(mockComposio.create).toHaveBeenCalledWith(
        "account-123",
        expect.objectContaining({
          authConfigs: expect.objectContaining({ tiktok: "ac_tiktok_xyz" }),
        }),
      );
    } finally {
      if (orig === undefined) delete process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
      else process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID = orig;
    }
  });
});
