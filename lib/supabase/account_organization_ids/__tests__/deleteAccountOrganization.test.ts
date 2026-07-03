import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteAccountOrganization } from "../deleteAccountOrganization";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

function mockDeleteChain(result: { error: Error | null }) {
  const secondEq = vi.fn().mockResolvedValue(result);
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
  const deleteFn = vi.fn().mockReturnValue({ eq: firstEq });
  vi.mocked(supabase.from).mockReturnValue({ delete: deleteFn } as never);
  return { deleteFn, firstEq, secondEq };
}

describe("deleteAccountOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the membership row is deleted", async () => {
    const { firstEq, secondEq } = mockDeleteChain({ error: null });

    const result = await deleteAccountOrganization("account-1", "org-1");

    expect(result).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith("account_organization_ids");
    expect(firstEq).toHaveBeenCalledWith("account_id", "account-1");
    expect(secondEq).toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("returns false on database error", async () => {
    mockDeleteChain({ error: new Error("DB error") });

    const result = await deleteAccountOrganization("account-1", "org-1");

    expect(result).toBe(false);
  });

  it("returns false when accountId is empty", async () => {
    const result = await deleteAccountOrganization("", "org-1");

    expect(result).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns false when organizationId is empty", async () => {
    const result = await deleteAccountOrganization("account-1", "");

    expect(result).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
