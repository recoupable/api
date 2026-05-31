import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRecoupAdmin } from "@/lib/organizations/isRecoupAdmin";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-org-id",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isRecoupAdmin", () => {
  it("returns false for an empty/missing accountId without querying", async () => {
    expect(await isRecoupAdmin("")).toBe(false);
    expect(getAccountOrganizations).not.toHaveBeenCalled();
  });

  it("returns true when the account is a member of the Recoup org", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { organization_id: "some-other-org" } as never,
      { organization_id: "recoup-org-id" } as never,
    ]);

    expect(await isRecoupAdmin("acc-1")).toBe(true);
    expect(getAccountOrganizations).toHaveBeenCalledWith({ accountId: "acc-1" });
  });

  it("returns false when the account is in orgs but none is Recoup", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { organization_id: "org-a" } as never,
      { organization_id: "org-b" } as never,
    ]);

    expect(await isRecoupAdmin("acc-1")).toBe(false);
  });

  it("returns false when the account is in no orgs", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([]);

    expect(await isRecoupAdmin("acc-1")).toBe(false);
  });
});
