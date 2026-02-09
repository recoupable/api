import { describe, it, expect, vi, beforeEach } from "vitest";

import { deleteAccountSnapshot } from "../deleteAccountSnapshot";

const mockFrom = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

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
              return {
                select: (...sArgs: unknown[]) => {
                  mockSelect(...sArgs);
                  return { single: mockSingle };
                },
              };
            },
          };
        },
      };
    },
  },
}));

describe("deleteAccountSnapshot", () => {
  const mockAccountId = "550e8400-e29b-41d4-a716-446655440000";
  const mockSnapshot = {
    account_id: mockAccountId,
    snapshot_id: "snap_abc123",
    github_repo: "https://github.com/recoupable/test-repo",
    expires_at: "2027-01-01T00:00:00.000Z",
    created_at: "2025-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the snapshot and returns the deleted row", async () => {
    mockSingle.mockResolvedValue({ data: mockSnapshot, error: null });

    const result = await deleteAccountSnapshot(mockAccountId);

    expect(mockFrom).toHaveBeenCalledWith("account_snapshots");
    expect(mockEq).toHaveBeenCalledWith("account_id", mockAccountId);
    expect(result).toEqual(mockSnapshot);
  });

  it("returns null when there is an error", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const result = await deleteAccountSnapshot(mockAccountId);

    expect(result).toBeNull();
  });

  it("returns null when no data is returned", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const result = await deleteAccountSnapshot(mockAccountId);

    expect(result).toBeNull();
  });
});
