import { describe, it, expect, vi, beforeEach } from "vitest";

import selectAgentStatusBySocialIds from "../selectAgentStatusBySocialIds";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("selectAgentStatusBySocialIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ in: mockIn });
  });

  it("returns empty array when socialIds is empty", async () => {
    const result = await selectAgentStatusBySocialIds({ socialIds: [] });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns empty array when socialIds is not provided", async () => {
    const result = await selectAgentStatusBySocialIds({});

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns agent_status records for given social IDs using select('*')", async () => {
    const mockAgentStatus = [
      {
        id: "status-1",
        agent_id: "agent-1",
        social_id: "social-1",
        status: 1,
        progress: 100,
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "status-2",
        agent_id: "agent-2",
        social_id: "social-2",
        status: 1,
        progress: 50,
        updated_at: "2024-01-02T00:00:00Z",
      },
    ];
    mockIn.mockResolvedValue({ data: mockAgentStatus, error: null });

    const result = await selectAgentStatusBySocialIds({
      socialIds: ["social-1", "social-2"],
    });

    expect(mockFrom).toHaveBeenCalledWith("agent_status");
    expect(mockSelect).toHaveBeenCalledWith("*, agent:agents(*)");
    expect(mockIn).toHaveBeenCalledWith("social_id", ["social-1", "social-2"]);
    expect(result).toEqual(mockAgentStatus);
  });

  it("throws error when database query fails", async () => {
    const mockError = { message: "Database connection failed" };
    mockIn.mockResolvedValue({ data: null, error: mockError });

    await expect(
      selectAgentStatusBySocialIds({ socialIds: ["social-1"] })
    ).rejects.toEqual(mockError);
  });

  it("returns empty array when data is null but no error", async () => {
    mockIn.mockResolvedValue({ data: null, error: null });

    const result = await selectAgentStatusBySocialIds({
      socialIds: ["social-1"],
    });

    expect(result).toEqual([]);
  });

  it("returns agent_status with joined agent data", async () => {
    const mockAgentStatusWithAgent = [
      {
        id: "status-1",
        agent_id: "agent-1",
        social_id: "social-1",
        status: 1,
        progress: 100,
        updated_at: "2024-01-01T00:00:00Z",
        agent: {
          id: "agent-1",
          updated_at: "2024-01-01T00:00:00Z",
        },
      },
    ];
    mockIn.mockResolvedValue({ data: mockAgentStatusWithAgent, error: null });

    const result = await selectAgentStatusBySocialIds({
      socialIds: ["social-1"],
    });

    expect(result).toEqual(mockAgentStatusWithAgent);
    expect(result[0]).toHaveProperty("agent");
    expect(result[0].agent).toHaveProperty("id", "agent-1");
  });
});
