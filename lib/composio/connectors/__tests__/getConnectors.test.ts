import { describe, it, expect, vi, beforeEach } from "vitest";
import { getConnectors } from "../getConnectors";

import { getComposioClient } from "../../client";

vi.mock("../../client", () => ({
  getComposioClient: vi.fn(),
}));

describe("getConnectors", () => {
  const mockToolkits = vi.fn();
  const mockSession = { toolkits: mockToolkits };
  const mockComposio = { create: vi.fn(() => mockSession) };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getComposioClient).mockResolvedValue(mockComposio);
  });

  it("should return connectors list with connection status", async () => {
    mockToolkits.mockResolvedValue({
      items: [
        {
          slug: "googlesheets",
          name: "Google Sheets",
          connection: { isActive: true, connectedAccount: { id: "ca_123" } },
        },
        {
          slug: "googledrive",
          name: "Google Drive",
          connection: null,
        },
      ],
    });

    const result = await getConnectors("account-123");

    expect(getComposioClient).toHaveBeenCalled();
    expect(mockComposio.create).toHaveBeenCalledWith("account-123", {
      toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok", "instagram", "youtube"],
    });
    expect(result).toEqual([
      {
        slug: "googlesheets",
        name: "Google Sheets",
        isConnected: true,
        connectedAccountId: "ca_123",
      },
      {
        slug: "googledrive",
        name: "Google Drive",
        isConnected: false,
        connectedAccountId: undefined,
      },
    ]);
  });

  it("should use custom display names when provided", async () => {
    mockToolkits.mockResolvedValue({
      items: [
        {
          slug: "tiktok",
          name: "tiktok",
          connection: null,
        },
      ],
    });

    const result = await getConnectors("account-123", {
      displayNames: { tiktok: "TikTok" },
    });

    expect(result[0].name).toBe("TikTok");
  });

  it("should pass authConfigs when custom OAuth env vars are set", async () => {
    const origTiktok = process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
    const origInstagram = process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID;
    const origSheets = process.env.COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID;
    const origDocs = process.env.COMPOSIO_GOOGLE_DOCS_AUTH_CONFIG_ID;
    const origDrive = process.env.COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID;

    try {
      process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID = "ac_tiktok_123";
      process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID = "ac_instagram_456";
      process.env.COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID = "ac_sheets_789";
      process.env.COMPOSIO_GOOGLE_DOCS_AUTH_CONFIG_ID = "ac_docs_abc";
      process.env.COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID = "ac_drive_def";

      mockToolkits.mockResolvedValue({ items: [] });

      await getConnectors("account-123");

      expect(mockComposio.create).toHaveBeenCalledWith("account-123", {
        toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok", "instagram", "youtube"],
        authConfigs: {
          tiktok: "ac_tiktok_123",
          instagram: "ac_instagram_456",
          googlesheets: "ac_sheets_789",
          googledocs: "ac_docs_abc",
          googledrive: "ac_drive_def",
        },
      });
    } finally {
      if (origTiktok === undefined) delete process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
      else process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID = origTiktok;
      if (origInstagram === undefined) delete process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID;
      else process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID = origInstagram;
      if (origSheets === undefined) delete process.env.COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID;
      else process.env.COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID = origSheets;
      if (origDocs === undefined) delete process.env.COMPOSIO_GOOGLE_DOCS_AUTH_CONFIG_ID;
      else process.env.COMPOSIO_GOOGLE_DOCS_AUTH_CONFIG_ID = origDocs;
      if (origDrive === undefined) delete process.env.COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID;
      else process.env.COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID = origDrive;
    }
  });

  it("should handle inactive connections", async () => {
    mockToolkits.mockResolvedValue({
      items: [
        {
          slug: "googlesheets",
          name: "Google Sheets",
          connection: { isActive: false, connectedAccount: { id: "ca_123" } },
        },
      ],
    });

    const result = await getConnectors("account-123");

    expect(result[0].isConnected).toBe(false);
  });
});
