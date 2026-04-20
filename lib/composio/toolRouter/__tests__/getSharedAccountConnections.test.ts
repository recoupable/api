import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSharedAccountConnections } from "../getSharedAccountConnections";

import { getConnectors } from "../../connectors/getConnectors";

vi.mock("../../connectors/getConnectors", () => ({
  getConnectors: vi.fn(),
}));

const SHARED_ACCOUNT_ID = "recoup-shared-767f498e-e1e9-43c6-a152-a96ae3bd8d07";

describe("getSharedAccountConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(getConnectors).toHaveBeenCalledWith(SHARED_ACCOUNT_ID);
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

  it("should use the hardcoded shared account ID", async () => {
    vi.mocked(getConnectors).mockResolvedValue([]);

    await getSharedAccountConnections();

    expect(getConnectors).toHaveBeenCalledWith(SHARED_ACCOUNT_ID);
  });
});
