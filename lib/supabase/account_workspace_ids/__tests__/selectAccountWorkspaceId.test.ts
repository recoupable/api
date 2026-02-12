import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAccountWorkspaceId } from "../selectAccountWorkspaceId";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

import supabase from "../../serverClient";

describe("selectAccountWorkspaceId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the row when account owns the workspace", async () => {
    const row = { workspace_id: "ws-123" };
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      }),
    } as never);

    const result = await selectAccountWorkspaceId("account-123", "ws-123");

    expect(supabase.from).toHaveBeenCalledWith("account_workspace_ids");
    expect(result).toEqual(row);
  });

  it("should return null when no ownership exists", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as never);

    const result = await selectAccountWorkspaceId("account-123", "ws-123");

    expect(result).toBeNull();
  });

  it("should return null on database error", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("DB error"),
            }),
          }),
        }),
      }),
    } as never);

    const result = await selectAccountWorkspaceId("account-123", "ws-123");

    expect(result).toBeNull();
  });
});
