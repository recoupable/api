import { describe, it, expect, vi, beforeEach } from "vitest";

import selectAgentsWithStatusAndSocials from "../selectAgentsWithStatusAndSocials";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("selectAgentsWithStatusAndSocials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ in: mockIn });
  });

  it("returns empty array when agentIds is empty", async () => {
    const result = await selectAgentsWithStatusAndSocials({ agentIds: [] });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns empty array when agentIds is not provided", async () => {
    const result = await selectAgentsWithStatusAndSocials({});

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns agents with agent_status and socials for given agent IDs", async () => {
    const mockAgents = [
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
    ];
    mockIn.mockResolvedValue({ data: mockAgents, error: null });

    const result = await selectAgentsWithStatusAndSocials({
      agentIds: ["agent-1"],
    });

    expect(mockFrom).toHaveBeenCalledWith("agents");
    expect(mockSelect).toHaveBeenCalledWith("*, agent_status(*, social:socials(*))");
    expect(mockIn).toHaveBeenCalledWith("id", ["agent-1"]);
    expect(result).toEqual(mockAgents);
  });

  it("throws error when database query fails", async () => {
    const mockError = { message: "Database connection failed" };
    mockIn.mockResolvedValue({ data: null, error: mockError });

    await expect(
      selectAgentsWithStatusAndSocials({ agentIds: ["agent-1"] })
    ).rejects.toEqual(mockError);
  });

  it("returns empty array when data is null but no error", async () => {
    mockIn.mockResolvedValue({ data: null, error: null });

    const result = await selectAgentsWithStatusAndSocials({
      agentIds: ["agent-1"],
    });

    expect(result).toEqual([]);
  });

  it("returns agent with multiple agent_status entries (wrapped agent)", async () => {
    const mockWrappedAgent = [
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
    ];
    mockIn.mockResolvedValue({ data: mockWrappedAgent, error: null });

    const result = await selectAgentsWithStatusAndSocials({
      agentIds: ["agent-1"],
    });

    expect(result).toEqual(mockWrappedAgent);
    expect(result[0].agent_status).toHaveLength(2);
  });
});
