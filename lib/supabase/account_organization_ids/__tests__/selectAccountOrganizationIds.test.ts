import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAccountOrganizationIds } from "../selectAccountOrganizationIds";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

import supabase from "../../serverClient";

describe("selectAccountOrganizationIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return matching organization IDs for an account", async () => {
    const rows = [{ organization_id: "org-1" }];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      }),
    } as never);

    const result = await selectAccountOrganizationIds("account-123", ["org-1", "org-2"]);

    expect(supabase.from).toHaveBeenCalledWith("account_organization_ids");
    expect(result).toEqual(rows);
  });

  it("should return empty array when account has no matching orgs", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    } as never);

    const result = await selectAccountOrganizationIds("account-123", ["org-1"]);

    expect(result).toEqual([]);
  });

  it("should return null on database error", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("DB error"),
            }),
          }),
        }),
      }),
    } as never);

    const result = await selectAccountOrganizationIds("account-123", ["org-1"]);

    expect(result).toBeNull();
  });

  it("should return empty array when orgIds is empty", async () => {
    const result = await selectAccountOrganizationIds("account-123", []);

    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
