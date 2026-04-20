import { describe, it, expect, vi, beforeEach } from "vitest";
import { createToolRouterSession } from "../createToolRouterSession";

import { getComposioClient } from "../../client";
import { getCallbackUrl } from "../../getCallbackUrl";
import { getConnectors } from "../../connectors/getConnectors";
import { getSharedAccountConnections } from "../getSharedAccountConnections";

vi.mock("../../client", () => ({
  getComposioClient: vi.fn(),
}));

vi.mock("../../getCallbackUrl", () => ({
  getCallbackUrl: vi.fn(),
}));

vi.mock("../../connectors/getConnectors", () => ({
  getConnectors: vi.fn(),
}));

vi.mock("../getSharedAccountConnections", () => ({
  getSharedAccountConnections: vi.fn(),
}));

describe("createToolRouterSession", () => {
  const mockSession = { tools: vi.fn() };
  const mockComposio = { create: vi.fn(() => mockSession) };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getComposioClient).mockResolvedValue(mockComposio);
    vi.mocked(getCallbackUrl).mockReturnValue("https://example.com/chat?connected=true");
    // Default: account has no connections
    vi.mocked(getConnectors).mockResolvedValue([]);
    // Default: shared account has no connections
    vi.mocked(getSharedAccountConnections).mockResolvedValue({});
  });

  it("should create session with enabled toolkits", async () => {
    await createToolRouterSession("account-123");

    expect(getComposioClient).toHaveBeenCalled();
    expect(mockComposio.create).toHaveBeenCalledWith("account-123", {
      toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok"],
      manageConnections: {
        callbackUrl: "https://example.com/chat?connected=true",
      },
      connectedAccounts: undefined,
    });
  });

  it("should include roomId in callback URL", async () => {
    await createToolRouterSession("account-123", "room-456");

    expect(getCallbackUrl).toHaveBeenCalledWith({
      destination: "chat",
      roomId: "room-456",
    });
  });

  it("should pass artist connections when account has no overlap", async () => {
    // Account has Google Sheets connected but NOT TikTok
    vi.mocked(getConnectors).mockResolvedValue([
      {
        slug: "googlesheets",
        name: "Google Sheets",
        isConnected: true,
        connectedAccountId: "gs-123",
      },
      { slug: "tiktok", name: "TikTok", isConnected: false },
    ]);

    const artistConnections = { tiktok: "artist-tiktok-789" };
    await createToolRouterSession("account-123", undefined, artistConnections);

    // Artist's TikTok should pass through (account doesn't have it connected)
    expect(mockComposio.create).toHaveBeenCalledWith("account-123", {
      toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok"],
      manageConnections: {
        callbackUrl: "https://example.com/chat?connected=true",
      },
      connectedAccounts: { tiktok: "artist-tiktok-789" },
    });
  });

  it("should filter out artist connections that overlap with account", async () => {
    // Account already has TikTok connected
    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "account-tiktok" },
    ]);

    const artistConnections = { tiktok: "artist-tiktok-789" };
    await createToolRouterSession("account-123", undefined, artistConnections);

    // Artist's TikTok should be filtered out (account already has it)
    expect(mockComposio.create).toHaveBeenCalledWith("account-123", {
      toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok"],
      manageConnections: {
        callbackUrl: "https://example.com/chat?connected=true",
      },
      connectedAccounts: undefined,
    });
  });

  it("should return session object", async () => {
    const result = await createToolRouterSession("account-123");

    expect(result).toBe(mockSession);
  });

  it("should handle undefined roomId", async () => {
    await createToolRouterSession("account-123", undefined);

    expect(getCallbackUrl).toHaveBeenCalledWith({
      destination: "chat",
      roomId: undefined,
    });
  });

  it("should use shared account Google connections when account has none", async () => {
    // Account has no Google connections
    vi.mocked(getConnectors).mockResolvedValue([]);
    vi.mocked(getSharedAccountConnections).mockResolvedValue({
      googledrive: "shared-drive-123",
      googlesheets: "shared-sheets-456",
      googledocs: "shared-docs-789",
    });

    await createToolRouterSession("account-123");

    expect(getSharedAccountConnections).toHaveBeenCalled();
    expect(mockComposio.create).toHaveBeenCalledWith("account-123", {
      toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok"],
      manageConnections: {
        callbackUrl: "https://example.com/chat?connected=true",
      },
      connectedAccounts: {
        googledrive: "shared-drive-123",
        googlesheets: "shared-sheets-456",
        googledocs: "shared-docs-789",
      },
    });
  });

  it("should not use shared connections for toolkits account already has", async () => {
    // Account has Google Drive connected
    vi.mocked(getConnectors).mockResolvedValue([
      {
        slug: "googledrive",
        name: "Google Drive",
        isConnected: true,
        connectedAccountId: "account-drive-own",
      },
    ]);
    vi.mocked(getSharedAccountConnections).mockResolvedValue({
      googledrive: "shared-drive-123",
      googlesheets: "shared-sheets-456",
    });

    await createToolRouterSession("account-123");

    // Only Google Sheets should use shared (account already has Drive)
    expect(mockComposio.create).toHaveBeenCalledWith("account-123", {
      toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok"],
      manageConnections: {
        callbackUrl: "https://example.com/chat?connected=true",
      },
      connectedAccounts: {
        googlesheets: "shared-sheets-456",
      },
    });
  });

  it("should merge shared connections with artist connections", async () => {
    // Account has no connections
    vi.mocked(getConnectors).mockResolvedValue([]);
    vi.mocked(getSharedAccountConnections).mockResolvedValue({
      googledrive: "shared-drive-123",
    });

    const artistConnections = { tiktok: "artist-tiktok-789" };
    await createToolRouterSession("account-123", undefined, artistConnections);

    expect(mockComposio.create).toHaveBeenCalledWith("account-123", {
      toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok"],
      manageConnections: {
        callbackUrl: "https://example.com/chat?connected=true",
      },
      connectedAccounts: {
        tiktok: "artist-tiktok-789",
        googledrive: "shared-drive-123",
      },
    });
  });

  it("should not override artist Google connections with shared connections", async () => {
    // Account has no connections, but artist has Google Drive connected
    vi.mocked(getConnectors).mockResolvedValue([]);
    vi.mocked(getSharedAccountConnections).mockResolvedValue({
      googledrive: "shared-drive-123",
    });

    const artistConnections = { googledrive: "artist-drive-456" };
    await createToolRouterSession("account-123", undefined, artistConnections);

    // Artist connection should take precedence over shared
    expect(mockComposio.create).toHaveBeenCalledWith("account-123", {
      toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok"],
      manageConnections: {
        callbackUrl: "https://example.com/chat?connected=true",
      },
      connectedAccounts: {
        googledrive: "artist-drive-456",
      },
    });
  });
});
