import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectSlackInstallationByTeamId } from "../selectSlackInstallationByTeamId";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return { maybeSingle: mockMaybeSingle };
            },
          };
        },
      };
    },
  },
}));

const mockInstallation = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  slack_team_id: "T01234567",
  slack_team_name: "Test Workspace",
  organization_id: "660e8400-e29b-41d4-a716-446655440000",
  bot_token: "xoxb-test-token",
  installed_by: "770e8400-e29b-41d4-a716-446655440000",
  created_at: "2026-03-27T00:00:00.000Z",
  updated_at: "2026-03-27T00:00:00.000Z",
};

describe("selectSlackInstallationByTeamId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects by slack_team_id", async () => {
    mockMaybeSingle.mockResolvedValue({ data: mockInstallation, error: null });

    const result = await selectSlackInstallationByTeamId("T01234567");

    expect(mockFrom).toHaveBeenCalledWith("slack_installations");
    expect(mockEq).toHaveBeenCalledWith("slack_team_id", "T01234567");
    expect(result).toEqual(mockInstallation);
  });

  it("returns null on error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "Error" } });

    const result = await selectSlackInstallationByTeamId("bad-team");

    expect(result).toBeNull();
  });

  it("returns null when not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await selectSlackInstallationByTeamId("missing");

    expect(result).toBeNull();
  });
});
