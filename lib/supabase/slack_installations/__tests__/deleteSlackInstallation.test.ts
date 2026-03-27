import { describe, it, expect, vi, beforeEach } from "vitest";

import { deleteSlackInstallation } from "../deleteSlackInstallation";

const mockFrom = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        delete: (...dArgs: unknown[]) => {
          mockDelete(...dArgs);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return mockResult;
            },
          };
        },
      };
    },
  },
}));

let mockResult: { error: { message: string } | null } = { error: null };

describe("deleteSlackInstallation", () => {
  const orgId = "660e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes by organization_id", async () => {
    await deleteSlackInstallation(orgId);

    expect(mockFrom).toHaveBeenCalledWith("slack_installations");
    expect(mockEq).toHaveBeenCalledWith("organization_id", orgId);
  });

  it("throws on error", async () => {
    mockResult = { error: { message: "Delete failed" } };

    await expect(deleteSlackInstallation(orgId)).rejects.toThrow(
      "Failed to delete slack installation: Delete failed",
    );
  });
});
