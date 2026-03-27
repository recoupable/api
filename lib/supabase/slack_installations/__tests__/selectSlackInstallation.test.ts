import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectSlackInstallation } from "../selectSlackInstallation";

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

describe("selectSlackInstallation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects by id", async () => {
    mockMaybeSingle.mockResolvedValue({ data: mockInstallation, error: null });

    const result = await selectSlackInstallation({ id: mockInstallation.id });

    expect(mockFrom).toHaveBeenCalledWith("slack_installations");
    expect(mockEq).toHaveBeenCalledWith("id", mockInstallation.id);
    expect(result).toEqual(mockInstallation);
  });

  it("selects by organizationId", async () => {
    mockMaybeSingle.mockResolvedValue({ data: mockInstallation, error: null });

    const result = await selectSlackInstallation({
      organizationId: mockInstallation.organization_id,
    });

    expect(mockFrom).toHaveBeenCalledWith("slack_installations");
    expect(mockEq).toHaveBeenCalledWith("organization_id", mockInstallation.organization_id);
    expect(result).toEqual(mockInstallation);
  });

  it("returns null on error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "Error" } });

    const result = await selectSlackInstallation({ id: "bad-id" });

    expect(result).toBeNull();
  });

  it("returns null when not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await selectSlackInstallation({ id: "missing" });

    expect(result).toBeNull();
  });
});
