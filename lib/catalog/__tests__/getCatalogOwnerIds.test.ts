import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCatalogOwnerIds } from "../getCatalogOwnerIds";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

describe("getCatalogOwnerIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns just the account when it belongs to no organization", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([]);

    expect(await getCatalogOwnerIds("acc_1")).toEqual(["acc_1"]);
    expect(getAccountOrganizations).toHaveBeenCalledWith({ accountId: "acc_1" });
  });

  it("puts the account first, then every organization it belongs to", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { organization_id: "org_1" },
      { organization_id: "org_2" },
    ] as never);

    expect(await getCatalogOwnerIds("acc_1")).toEqual(["acc_1", "org_1", "org_2"]);
  });

  it("drops rows with a null organization_id", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { organization_id: null },
      { organization_id: "org_1" },
    ] as never);

    expect(await getCatalogOwnerIds("acc_1")).toEqual(["acc_1", "org_1"]);
  });

  it("does not repeat the account when it is also returned as an organization", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([{ organization_id: "acc_1" }] as never);

    expect(await getCatalogOwnerIds("acc_1")).toEqual(["acc_1"]);
  });

  it("deduplicates a repeated organization membership", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { organization_id: "org_1" },
      { organization_id: "org_1" },
    ] as never);

    expect(await getCatalogOwnerIds("acc_1")).toEqual(["acc_1", "org_1"]);
  });
});
