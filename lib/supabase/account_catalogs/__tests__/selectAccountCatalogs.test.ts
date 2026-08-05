import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAccountCatalogs } from "../selectAccountCatalogs";
import supabase from "../../serverClient";
import { getAccountOrganizations } from "../../account_organization_ids/getAccountOrganizations";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return { default: { from: mockFrom } };
});

vi.mock("../../account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

/** Mocks the account_catalogs query chain, capturing the owner ids it filters on. */
function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {} as never;
  for (const m of ["select", "eq", "in"]) builder[m] = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockResolvedValue(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

const catalog = (id: string) => ({
  id,
  name: `catalog ${id}`,
  created_at: "2026-08-05T00:00:00Z",
  updated_at: "2026-08-05T00:00:00Z",
});

describe("selectAccountCatalogs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries only the account's own id when it belongs to no organization", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([]);
    const builder = mockBuilder({ data: [{ catalogs: catalog("cat_1") }], error: null });

    const result = await selectAccountCatalogs("acc_1");

    expect(supabase.from).toHaveBeenCalledWith("account_catalogs");
    expect(builder.in).toHaveBeenCalledWith("account", ["acc_1"]);
    expect(result).toEqual([catalog("cat_1")]);
  });

  it("includes the catalogs of every organization the account belongs to", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { organization_id: "org_1" },
      { organization_id: "org_2" },
    ] as never);
    const builder = mockBuilder({
      data: [{ catalogs: catalog("own") }, { catalogs: catalog("from_org") }],
      error: null,
    });

    const result = await selectAccountCatalogs("acc_1");

    expect(builder.in).toHaveBeenCalledWith("account", ["acc_1", "org_1", "org_2"]);
    expect(result).toEqual([catalog("own"), catalog("from_org")]);
  });

  it("returns a catalog once when it is owned both directly and through an organization", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([{ organization_id: "org_1" }] as never);
    mockBuilder({
      data: [{ catalogs: catalog("shared") }, { catalogs: catalog("shared") }],
      error: null,
    });

    const result = await selectAccountCatalogs("acc_1");

    expect(result).toEqual([catalog("shared")]);
  });

  it("ignores organization rows with a null organization_id", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { organization_id: null },
      { organization_id: "org_1" },
    ] as never);
    const builder = mockBuilder({ data: [], error: null });

    await selectAccountCatalogs("acc_1");

    expect(builder.in).toHaveBeenCalledWith("account", ["acc_1", "org_1"]);
  });

  it("does not duplicate the account id when it is also returned as an organization", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([{ organization_id: "acc_1" }] as never);
    const builder = mockBuilder({ data: [], error: null });

    await selectAccountCatalogs("acc_1");

    expect(builder.in).toHaveBeenCalledWith("account", ["acc_1"]);
  });

  it("throws when the query fails", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([]);
    mockBuilder({ data: null, error: { message: "boom" } });

    await expect(selectAccountCatalogs("acc_1")).rejects.toThrow(
      "Failed to fetch account_catalogs: boom",
    );
  });
});
