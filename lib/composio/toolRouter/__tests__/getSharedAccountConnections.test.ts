import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSharedAccountConnections } from "../getSharedAccountConnections";

import { getConnectors } from "../../connectors/getConnectors";

vi.mock("../../connectors/getConnectors", () => ({
  getConnectors: vi.fn(),
}));

const SHARED_ENTITY = "shared@recoupable.com";

describe("getSharedAccountConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.COMPOSIO_SHARED_ENTITY_ID;
  });

  it("should return Google connections from the shared account", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      {
        slug: "googledrive",
        name: "Google Drive",
        isConnected: true,
        connectedAccountId: "shared-drive-123",
      },
      {
        slug: "googlesheets",
        name: "Google Sheets",
        isConnected: true,
        connectedAccountId: "shared-sheets-456",
      },
      {
        slug: "googledocs",
        name: "Google Docs",
        isConnected: true,
        connectedAccountId: "shared-docs-789",
      },
    ]);

    const result = await getSharedAccountConnections();

    expect(getConnectors).toHaveBeenCalledWith(SHARED_ENTITY);
    expect(result).toEqual({
      googledrive: "shared-drive-123",
      googlesheets: "shared-sheets-456",
      googledocs: "shared-docs-789",
    });
  });

  it("should only return connected Google toolkits", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      {
        slug: "googledrive",
        name: "Google Drive",
        isConnected: true,
        connectedAccountId: "shared-drive-123",
      },
      {
        slug: "googlesheets",
        name: "Google Sheets",
        isConnected: false,
      },
      {
        slug: "tiktok",
        name: "TikTok",
        isConnected: true,
        connectedAccountId: "shared-tiktok-999",
      },
    ]);

    const result = await getSharedAccountConnections();

    expect(result).toEqual({
      googledrive: "shared-drive-123",
    });
  });

  it("should return empty object when no Google toolkits are connected", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "tk-1" },
    ]);

    const result = await getSharedAccountConnections();

    expect(result).toEqual({});
  });

  it("should use COMPOSIO_SHARED_ENTITY_ID env var when set", async () => {
    process.env.COMPOSIO_SHARED_ENTITY_ID = "custom-shared-entity";
    vi.mocked(getConnectors).mockResolvedValue([]);

    await getSharedAccountConnections();

    expect(getConnectors).toHaveBeenCalledWith("custom-shared-entity");
  });
});
