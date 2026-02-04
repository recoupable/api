import { describe, it, expect, vi, beforeEach } from "vitest";
import { getArtistConnectionsFromComposio } from "../getArtistConnectionsFromComposio";

// Mock dependencies
vi.mock("../../connectors", () => ({
  getConnectors: vi.fn(),
  ALLOWED_ARTIST_CONNECTORS: ["tiktok"],
}));

import { getConnectors } from "../../connectors";

describe("getArtistConnectionsFromComposio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty object when no connectors are connected", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "tiktok", connectedAccountId: null },
    ]);

    const result = await getArtistConnectionsFromComposio("artist-123");

    expect(getConnectors).toHaveBeenCalledWith("artist-123", {
      allowedToolkits: ["tiktok"],
    });
    expect(result).toEqual({});
  });

  it("should return connections map for connected connectors", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "tiktok", connectedAccountId: "tiktok-account-456" },
    ]);

    const result = await getArtistConnectionsFromComposio("artist-123");

    expect(result).toEqual({
      tiktok: "tiktok-account-456",
    });
  });

  it("should filter out connectors without connectedAccountId", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "tiktok", connectedAccountId: "tiktok-account-456" },
      { slug: "instagram", connectedAccountId: null },
      { slug: "youtube", connectedAccountId: undefined },
    ]);

    const result = await getArtistConnectionsFromComposio("artist-789");

    expect(result).toEqual({
      tiktok: "tiktok-account-456",
    });
  });

  it("should handle multiple connected accounts", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "tiktok", connectedAccountId: "tiktok-account-1" },
      { slug: "instagram", connectedAccountId: "instagram-account-2" },
    ]);

    const result = await getArtistConnectionsFromComposio("artist-multi");

    expect(result).toEqual({
      tiktok: "tiktok-account-1",
      instagram: "instagram-account-2",
    });
  });

  it("should return empty object when getConnectors returns empty array", async () => {
    vi.mocked(getConnectors).mockResolvedValue([]);

    const result = await getArtistConnectionsFromComposio("artist-empty");

    expect(result).toEqual({});
  });
});
