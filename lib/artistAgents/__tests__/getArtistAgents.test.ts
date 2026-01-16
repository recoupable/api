import { describe, it, expect, vi, beforeEach } from "vitest";

import { getArtistAgents } from "../getArtistAgents";
import selectAgentStatusBySocialIds from "@/lib/supabase/agent_status/selectAgentStatusBySocialIds";
import selectAgentsWithStatusAndSocials from "@/lib/supabase/agents/selectAgentsWithStatusAndSocials";
import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";

vi.mock("@/lib/supabase/agent_status/selectAgentStatusBySocialIds", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/supabase/agents/selectAgentsWithStatusAndSocials", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/artists/getSocialPlatformByLink", () => ({
  getSocialPlatformByLink: vi.fn(),
}));

describe("getArtistAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when selectAgentStatusBySocialIds returns empty", async () => {
    vi.mocked(selectAgentStatusBySocialIds).mockResolvedValue([]);

    const result = await getArtistAgents(["social-1"]);

    expect(selectAgentStatusBySocialIds).toHaveBeenCalledWith({ socialIds: ["social-1"] });
    expect(selectAgentsWithStatusAndSocials).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns empty array when selectAgentStatusBySocialIds throws", async () => {
    vi.mocked(selectAgentStatusBySocialIds).mockRejectedValue(new Error("Database error"));

    const result = await getArtistAgents(["social-1"]);

    expect(result).toEqual([]);
  });

  it("returns empty array when selectAgentsWithStatusAndSocials throws", async () => {
    vi.mocked(selectAgentStatusBySocialIds).mockResolvedValue([
      {
        id: "status-1",
        agent_id: "agent-1",
        social_id: "social-1",
        status: 1,
        progress: 100,
        updated_at: "2024-01-01T00:00:00Z",
        agent: { id: "agent-1", updated_at: "2024-01-01T00:00:00Z" },
      },
    ]);
    vi.mocked(selectAgentsWithStatusAndSocials).mockRejectedValue(new Error("Database error"));

    const result = await getArtistAgents(["social-1"]);

    expect(result).toEqual([]);
  });

  it("returns empty array when selectAgentsWithStatusAndSocials returns empty", async () => {
    vi.mocked(selectAgentStatusBySocialIds).mockResolvedValue([
      {
        id: "status-1",
        agent_id: "agent-1",
        social_id: "social-1",
        status: 1,
        progress: 100,
        updated_at: "2024-01-01T00:00:00Z",
        agent: { id: "agent-1", updated_at: "2024-01-01T00:00:00Z" },
      },
    ]);
    vi.mocked(selectAgentsWithStatusAndSocials).mockResolvedValue([]);

    const result = await getArtistAgents(["social-1"]);

    expect(result).toEqual([]);
  });

  it("returns transformed agents for single-platform agents", async () => {
    vi.mocked(selectAgentStatusBySocialIds).mockResolvedValue([
      {
        id: "status-1",
        agent_id: "agent-1",
        social_id: "social-1",
        status: 1,
        progress: 100,
        updated_at: "2024-01-01T00:00:00Z",
        agent: { id: "agent-1", updated_at: "2024-01-01T00:00:00Z" },
      },
    ]);
    vi.mocked(selectAgentsWithStatusAndSocials).mockResolvedValue([
      {
        id: "agent-1",
        updated_at: "2024-01-01T00:00:00Z",
        agent_status: [
          {
            id: "status-1",
            agent_id: "agent-1",
            social_id: "social-1",
            status: 1,
            progress: 100,
            updated_at: "2024-01-01T00:00:00Z",
            social: {
              id: "social-1",
              profile_url: "https://twitter.com/artist1",
              username: "artist1",
              avatar: null,
              bio: null,
              followerCount: null,
              followingCount: null,
              region: null,
              updated_at: "2024-01-01T00:00:00Z",
            },
          },
        ],
      },
    ]);
    vi.mocked(getSocialPlatformByLink).mockReturnValue("Twitter");

    const result = await getArtistAgents(["social-1"]);

    expect(selectAgentStatusBySocialIds).toHaveBeenCalledWith({ socialIds: ["social-1"] });
    expect(selectAgentsWithStatusAndSocials).toHaveBeenCalledWith({ agentIds: ["agent-1"] });
    expect(getSocialPlatformByLink).toHaveBeenCalledWith("https://twitter.com/artist1");
    expect(result).toEqual([
      {
        type: "twitter",
        agentId: "agent-1",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ]);
  });

  it("returns 'wrapped' type for multi-platform agents", async () => {
    vi.mocked(selectAgentStatusBySocialIds).mockResolvedValue([
      {
        id: "status-1",
        agent_id: "agent-1",
        social_id: "social-1",
        status: 1,
        progress: 100,
        updated_at: "2024-01-01T00:00:00Z",
        agent: { id: "agent-1", updated_at: "2024-01-01T00:00:00Z" },
      },
    ]);
    vi.mocked(selectAgentsWithStatusAndSocials).mockResolvedValue([
      {
        id: "agent-1",
        updated_at: "2024-01-01T00:00:00Z",
        agent_status: [
          {
            id: "status-1",
            agent_id: "agent-1",
            social_id: "social-1",
            status: 1,
            progress: 100,
            updated_at: "2024-01-01T00:00:00Z",
            social: {
              id: "social-1",
              profile_url: "https://twitter.com/artist1",
              username: "artist1",
              avatar: null,
              bio: null,
              followerCount: null,
              followingCount: null,
              region: null,
              updated_at: "2024-01-01T00:00:00Z",
            },
          },
          {
            id: "status-2",
            agent_id: "agent-1",
            social_id: "social-2",
            status: 1,
            progress: 100,
            updated_at: "2024-01-01T00:00:00Z",
            social: {
              id: "social-2",
              profile_url: "https://instagram.com/artist1",
              username: "artist1",
              avatar: null,
              bio: null,
              followerCount: null,
              followingCount: null,
              region: null,
              updated_at: "2024-01-01T00:00:00Z",
            },
          },
        ],
      },
    ]);

    const result = await getArtistAgents(["social-1"]);

    expect(getSocialPlatformByLink).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        type: "wrapped",
        agentId: "agent-1",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ]);
  });

  it("aggregates agents by type (last one wins)", async () => {
    vi.mocked(selectAgentStatusBySocialIds).mockResolvedValue([
      {
        id: "status-1",
        agent_id: "agent-1",
        social_id: "social-1",
        status: 1,
        progress: 100,
        updated_at: "2024-01-01T00:00:00Z",
        agent: { id: "agent-1", updated_at: "2024-01-01T00:00:00Z" },
      },
      {
        id: "status-2",
        agent_id: "agent-2",
        social_id: "social-2",
        status: 1,
        progress: 100,
        updated_at: "2024-01-02T00:00:00Z",
        agent: { id: "agent-2", updated_at: "2024-01-02T00:00:00Z" },
      },
    ]);
    vi.mocked(selectAgentsWithStatusAndSocials).mockResolvedValue([
      {
        id: "agent-1",
        updated_at: "2024-01-01T00:00:00Z",
        agent_status: [
          {
            id: "status-1",
            agent_id: "agent-1",
            social_id: "social-1",
            status: 1,
            progress: 100,
            updated_at: "2024-01-01T00:00:00Z",
            social: {
              id: "social-1",
              profile_url: "https://twitter.com/artist1",
              username: "artist1",
              avatar: null,
              bio: null,
              followerCount: null,
              followingCount: null,
              region: null,
              updated_at: "2024-01-01T00:00:00Z",
            },
          },
        ],
      },
      {
        id: "agent-2",
        updated_at: "2024-01-02T00:00:00Z",
        agent_status: [
          {
            id: "status-2",
            agent_id: "agent-2",
            social_id: "social-2",
            status: 1,
            progress: 100,
            updated_at: "2024-01-02T00:00:00Z",
            social: {
              id: "social-2",
              profile_url: "https://twitter.com/artist2",
              username: "artist2",
              avatar: null,
              bio: null,
              followerCount: null,
              followingCount: null,
              region: null,
              updated_at: "2024-01-02T00:00:00Z",
            },
          },
        ],
      },
    ]);
    vi.mocked(getSocialPlatformByLink).mockReturnValue("Twitter");

    const result = await getArtistAgents(["social-1", "social-2"]);

    // Both agents are Twitter type, so only the last one should be returned
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe("agent-2");
    expect(result[0].type).toBe("twitter");
  });

  it("filters out agent status entries with null agent", async () => {
    vi.mocked(selectAgentStatusBySocialIds).mockResolvedValue([
      {
        id: "status-1",
        agent_id: "agent-1",
        social_id: "social-1",
        status: 1,
        progress: 100,
        updated_at: "2024-01-01T00:00:00Z",
        agent: null,
      },
      {
        id: "status-2",
        agent_id: "agent-2",
        social_id: "social-2",
        status: 1,
        progress: 100,
        updated_at: "2024-01-02T00:00:00Z",
        agent: { id: "agent-2", updated_at: "2024-01-02T00:00:00Z" },
      },
    ]);
    vi.mocked(selectAgentsWithStatusAndSocials).mockResolvedValue([
      {
        id: "agent-2",
        updated_at: "2024-01-02T00:00:00Z",
        agent_status: [
          {
            id: "status-2",
            agent_id: "agent-2",
            social_id: "social-2",
            status: 1,
            progress: 100,
            updated_at: "2024-01-02T00:00:00Z",
            social: {
              id: "social-2",
              profile_url: "https://twitter.com/artist2",
              username: "artist2",
              avatar: null,
              bio: null,
              followerCount: null,
              followingCount: null,
              region: null,
              updated_at: "2024-01-02T00:00:00Z",
            },
          },
        ],
      },
    ]);
    vi.mocked(getSocialPlatformByLink).mockReturnValue("Twitter");

    const result = await getArtistAgents(["social-1", "social-2"]);

    // Should only query for agent-2 since agent-1's agent is null
    expect(selectAgentsWithStatusAndSocials).toHaveBeenCalledWith({ agentIds: ["agent-2"] });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe("agent-2");
  });

  it("handles social with null profile_url gracefully", async () => {
    vi.mocked(selectAgentStatusBySocialIds).mockResolvedValue([
      {
        id: "status-1",
        agent_id: "agent-1",
        social_id: "social-1",
        status: 1,
        progress: 100,
        updated_at: "2024-01-01T00:00:00Z",
        agent: { id: "agent-1", updated_at: "2024-01-01T00:00:00Z" },
      },
    ]);
    vi.mocked(selectAgentsWithStatusAndSocials).mockResolvedValue([
      {
        id: "agent-1",
        updated_at: "2024-01-01T00:00:00Z",
        agent_status: [
          {
            id: "status-1",
            agent_id: "agent-1",
            social_id: "social-1",
            status: 1,
            progress: 100,
            updated_at: "2024-01-01T00:00:00Z",
            social: null,
          },
        ],
      },
    ]);
    vi.mocked(getSocialPlatformByLink).mockReturnValue("Unknown");

    const result = await getArtistAgents(["social-1"]);

    expect(getSocialPlatformByLink).toHaveBeenCalledWith("");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("unknown");
  });
});
