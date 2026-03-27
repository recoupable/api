import { describe, it, expect, vi, beforeEach } from "vitest";

import { upsertSlackInstallation } from "../upsertSlackInstallation";

const mockFrom = vi.fn();
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        upsert: (...uArgs: unknown[]) => {
          mockUpsert(...uArgs);
          return {
            select: (...sArgs: unknown[]) => {
              mockSelect(...sArgs);
              return { single: mockSingle };
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

describe("upsertSlackInstallation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts with slack_team_id conflict", async () => {
    mockSingle.mockResolvedValue({ data: mockInstallation, error: null });

    const input = {
      slack_team_id: "T01234567",
      slack_team_name: "Test Workspace",
      organization_id: "660e8400-e29b-41d4-a716-446655440000",
      bot_token: "xoxb-test-token",
      installed_by: "770e8400-e29b-41d4-a716-446655440000",
    };

    const result = await upsertSlackInstallation(input);

    expect(mockFrom).toHaveBeenCalledWith("slack_installations");
    expect(mockUpsert).toHaveBeenCalledWith(input, { onConflict: "slack_team_id" });
    expect(result).toEqual(mockInstallation);
  });

  it("throws on error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "Conflict" } });

    await expect(
      upsertSlackInstallation({
        slack_team_id: "T01234567",
        slack_team_name: "Test",
        organization_id: "org-id",
        bot_token: "token",
        installed_by: "user-id",
      }),
    ).rejects.toThrow("Failed to upsert slack installation: Conflict");
  });

  it("throws when no data returned", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      upsertSlackInstallation({
        slack_team_id: "T01234567",
        slack_team_name: "Test",
        organization_id: "org-id",
        bot_token: "token",
        installed_by: "user-id",
      }),
    ).rejects.toThrow("Failed to upsert slack installation: No data returned");
  });
});
