import { describe, it, expect, vi, beforeEach } from "vitest";
import { createToolRouterSessions } from "../createToolRouterSessions";

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

const SHARED_ACCOUNT_ID = "recoup-shared-767f498e-e1e9-43c6-a152-a96ae3bd8d07";

describe("createToolRouterSessions", () => {
  const customerSession = { id: "customer-session" };
  const artistSession = { id: "artist-session" };
  const sharedSession = { id: "shared-session" };

  const mockCreate = vi.fn();
  const mockComposio = { create: mockCreate };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getComposioClient).mockResolvedValue(mockComposio);
    vi.mocked(getCallbackUrl).mockReturnValue("https://example.com/chat?connected=true");
    vi.mocked(getConnectors).mockResolvedValue([]);
    vi.mocked(getSharedAccountConnections).mockResolvedValue({});
  });

  it("always creates a customer session with every enabled toolkit", async () => {
    mockCreate.mockResolvedValue(customerSession);

    const result = await createToolRouterSessions({ customerAccountId: "account-123" });

    expect(result.customer).toBe(customerSession);
    expect(mockCreate).toHaveBeenCalledWith(
      "account-123",
      expect.objectContaining({
        toolkits: ["googlesheets", "googledrive", "googledocs", "tiktok", "instagram"],
      }),
    );
  });

  it("does not create artist or shared sessions when neither has connections", async () => {
    mockCreate.mockResolvedValue(customerSession);

    const result = await createToolRouterSessions({ customerAccountId: "account-123" });

    expect(result.artist).toBeUndefined();
    expect(result.shared).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("creates artist session owned by artistId when artist has non-overlapping toolkits", async () => {
    mockCreate.mockImplementation(async (owner: string) => {
      if (owner === "artist-456") return artistSession;
      return customerSession;
    });
    vi.mocked(getConnectors).mockImplementation(async (id: string) => {
      if (id === "artist-456") {
        return [{ slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt" }];
      }
      return [];
    });

    const result = await createToolRouterSessions({
      customerAccountId: "account-123",
      artistId: "artist-456",
    });

    expect(result.artist).toBe(artistSession);
    expect(mockCreate).toHaveBeenCalledWith(
      "artist-456",
      expect.objectContaining({ toolkits: ["tiktok"] }),
    );
  });

  it("skips artist session when the artist has no connected toolkits after overlap filtering", async () => {
    mockCreate.mockResolvedValue(customerSession);
    vi.mocked(getConnectors).mockImplementation(async (id: string) => {
      if (id === "artist-456") {
        return [{ slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt" }];
      }
      // Customer already has TikTok connected
      if (id === "account-123") {
        return [
          { slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt_me" },
        ];
      }
      return [];
    });

    const result = await createToolRouterSessions({
      customerAccountId: "account-123",
      artistId: "artist-456",
    });

    expect(result.artist).toBeUndefined();
    // Only the customer session was created
    const artistCalls = mockCreate.mock.calls.filter(([owner]) => owner === "artist-456");
    expect(artistCalls).toHaveLength(0);
  });

  it("creates shared session owned by SHARED_ACCOUNT_ID when shared toolkits are available", async () => {
    mockCreate.mockImplementation(async (owner: string) => {
      if (owner === SHARED_ACCOUNT_ID) return sharedSession;
      return customerSession;
    });
    vi.mocked(getSharedAccountConnections).mockResolvedValue({
      googledocs: "ca_docs",
      googlesheets: "ca_sheets",
    });

    const result = await createToolRouterSessions({ customerAccountId: "account-123" });

    expect(result.shared).toBe(sharedSession);
    expect(mockCreate).toHaveBeenCalledWith(
      SHARED_ACCOUNT_ID,
      expect.objectContaining({
        toolkits: expect.arrayContaining(["googledocs", "googlesheets"]),
      }),
    );
  });

  it("skips shared session when customer already has those Google toolkits", async () => {
    mockCreate.mockResolvedValue(customerSession);
    vi.mocked(getConnectors).mockImplementation(async (id: string) => {
      if (id === "account-123") {
        return [
          {
            slug: "googledocs",
            name: "Google Docs",
            isConnected: true,
            connectedAccountId: "ca_my_docs",
          },
        ];
      }
      return [];
    });
    vi.mocked(getSharedAccountConnections).mockResolvedValue({
      googledocs: "ca_shared_docs",
    });

    const result = await createToolRouterSessions({ customerAccountId: "account-123" });

    expect(result.shared).toBeUndefined();
    const sharedCalls = mockCreate.mock.calls.filter(([owner]) => owner === SHARED_ACCOUNT_ID);
    expect(sharedCalls).toHaveLength(0);
  });

  it("creates all three sessions when customer, artist, and shared each have unique toolkits", async () => {
    mockCreate.mockImplementation(async (owner: string) => {
      if (owner === "artist-456") return artistSession;
      if (owner === SHARED_ACCOUNT_ID) return sharedSession;
      return customerSession;
    });
    vi.mocked(getConnectors).mockImplementation(async (id: string) => {
      if (id === "account-123") {
        return [
          {
            slug: "googledrive",
            name: "Google Drive",
            isConnected: true,
            connectedAccountId: "ca_drv",
          },
        ];
      }
      if (id === "artist-456") {
        return [{ slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt" }];
      }
      return [];
    });
    vi.mocked(getSharedAccountConnections).mockResolvedValue({
      googledocs: "ca_docs",
    });

    const result = await createToolRouterSessions({
      customerAccountId: "account-123",
      artistId: "artist-456",
    });

    expect(result.customer).toBe(customerSession);
    expect(result.artist).toBe(artistSession);
    expect(result.shared).toBe(sharedSession);
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("forwards roomId into the customer session's callback URL", async () => {
    mockCreate.mockResolvedValue(customerSession);

    await createToolRouterSessions({ customerAccountId: "account-123", roomId: "room-789" });

    expect(getCallbackUrl).toHaveBeenCalledWith({ destination: "chat", roomId: "room-789" });
  });

  it("does not pass connectedAccounts overrides to any session", async () => {
    mockCreate.mockResolvedValue(customerSession);
    vi.mocked(getSharedAccountConnections).mockResolvedValue({ googledocs: "ca_shared_docs" });

    await createToolRouterSessions({ customerAccountId: "account-123" });

    for (const call of mockCreate.mock.calls) {
      const opts = call[1] as Record<string, unknown>;
      expect(opts).not.toHaveProperty("connectedAccounts");
    }
  });
});
