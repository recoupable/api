import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichConnectorsWithSocials } from "../enrichConnectorsWithSocials";
import type { ConnectorInfo } from "../getConnectors";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";

vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));

describe("enrichConnectorsWithSocials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should add avatar and username from matching social profiles", async () => {
    const connectors: ConnectorInfo[] = [
      { slug: "instagram", name: "Instagram", isConnected: true, connectedAccountId: "ca_1" },
      { slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_2" },
    ];

    vi.mocked(selectAccountSocials).mockResolvedValue([
      {
        id: "as_1",
        account_id: "artist-123",
        social_id: "s_1",
        social: {
          id: "s_1",
          username: "artist_ig",
          profile_url: "https://www.instagram.com/artist_ig",
          avatar: "https://cdn.example.com/ig-avatar.jpg",
          bio: null,
          followerCount: 1000,
          followingCount: 50,
          region: null,
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
      {
        id: "as_2",
        account_id: "artist-123",
        social_id: "s_2",
        social: {
          id: "s_2",
          username: "artist_tt",
          profile_url: "https://tiktok.com/@artist_tt",
          avatar: "https://cdn.example.com/tt-avatar.jpg",
          bio: null,
          followerCount: 5000,
          followingCount: 100,
          region: null,
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
    ] as any);

    const result = await enrichConnectorsWithSocials(connectors, "artist-123");

    expect(result[0]).toMatchObject({
      slug: "instagram",
      avatar: "https://cdn.example.com/ig-avatar.jpg",
      username: "artist_ig",
    });
    expect(result[1]).toMatchObject({
      slug: "tiktok",
      avatar: "https://cdn.example.com/tt-avatar.jpg",
      username: "artist_tt",
    });
  });

  it("should not add social data for unconnected connectors", async () => {
    const connectors: ConnectorInfo[] = [
      { slug: "instagram", name: "Instagram", isConnected: false },
    ];

    vi.mocked(selectAccountSocials).mockResolvedValue([
      {
        id: "as_1",
        account_id: "artist-123",
        social_id: "s_1",
        social: {
          id: "s_1",
          username: "artist_ig",
          profile_url: "https://www.instagram.com/artist_ig",
          avatar: "https://cdn.example.com/ig-avatar.jpg",
          bio: null,
          followerCount: 1000,
          followingCount: 50,
          region: null,
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
    ] as any);

    const result = await enrichConnectorsWithSocials(connectors, "artist-123");

    expect(result[0].avatar).toBeUndefined();
    expect(result[0].username).toBeUndefined();
  });

  it("should handle no matching social profiles", async () => {
    const connectors: ConnectorInfo[] = [
      { slug: "instagram", name: "Instagram", isConnected: true, connectedAccountId: "ca_1" },
    ];

    vi.mocked(selectAccountSocials).mockResolvedValue([
      {
        id: "as_1",
        account_id: "artist-123",
        social_id: "s_1",
        social: {
          id: "s_1",
          username: "artist_tt",
          profile_url: "https://tiktok.com/@artist_tt",
          avatar: "https://cdn.example.com/tt-avatar.jpg",
          bio: null,
          followerCount: 1000,
          followingCount: 50,
          region: null,
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
    ] as any);

    const result = await enrichConnectorsWithSocials(connectors, "artist-123");

    expect(result[0].avatar).toBeUndefined();
    expect(result[0].username).toBeUndefined();
  });

  it("should handle null socials result", async () => {
    const connectors: ConnectorInfo[] = [
      { slug: "instagram", name: "Instagram", isConnected: true, connectedAccountId: "ca_1" },
    ];

    vi.mocked(selectAccountSocials).mockResolvedValue(null);

    const result = await enrichConnectorsWithSocials(connectors, "artist-123");

    expect(result[0].avatar).toBeUndefined();
  });

  it("should match by hostname and ignore subdomains", async () => {
    const connectors: ConnectorInfo[] = [
      { slug: "instagram", name: "Instagram", isConnected: true, connectedAccountId: "ca_1" },
    ];

    vi.mocked(selectAccountSocials).mockResolvedValue([
      {
        id: "as_1",
        account_id: "artist-123",
        social_id: "s_1",
        social: {
          id: "s_1",
          username: "artist_ig",
          profile_url: "https://scontent.cdninstagram.com/something",
          avatar: "https://cdn.example.com/wrong.jpg",
          bio: null,
          followerCount: 1000,
          followingCount: 50,
          region: null,
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
    ] as any);

    const result = await enrichConnectorsWithSocials(connectors, "artist-123");

    // cdninstagram.com is NOT instagram.com — should not match
    expect(result[0].avatar).toBeUndefined();
  });

  it("should not enrich non-social connectors like googlesheets", async () => {
    const connectors: ConnectorInfo[] = [
      { slug: "googlesheets", name: "Google Sheets", isConnected: true, connectedAccountId: "ca_1" },
    ];

    vi.mocked(selectAccountSocials).mockResolvedValue([]);

    const result = await enrichConnectorsWithSocials(connectors, "artist-123");

    expect(selectAccountSocials).toHaveBeenCalled();
    expect(result[0].avatar).toBeUndefined();
  });
});
