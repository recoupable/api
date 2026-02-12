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
    expect(mockComposio.create).toHaveBeenCalledWith("account-123");
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
