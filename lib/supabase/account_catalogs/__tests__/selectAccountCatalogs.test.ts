import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAccountCatalogs } from "../selectAccountCatalogs";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return { default: { from: mockFrom } };
});

/** Mocks the account_catalogs query chain, capturing the owner ids it filters on. */
function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {} as never;
  for (const m of ["select", "in"]) builder[m] = vi.fn().mockReturnValue(builder);
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

  it("filters on exactly the owner ids it is given", async () => {
    const builder = mockBuilder({
      data: [{ account: "acc_1", catalogs: catalog("cat_1") }],
      error: null,
    });

    const result = await selectAccountCatalogs(["acc_1", "org_1"]);

    expect(supabase.from).toHaveBeenCalledWith("account_catalogs");
    expect(builder.in).toHaveBeenCalledWith("account", ["acc_1", "org_1"]);
    expect(result).toEqual([{ ...catalog("cat_1"), owners: ["acc_1"] }]);
  });

  it("narrows to specific catalogs when asked, without a second query", async () => {
    const builder = mockBuilder({
      data: [{ account: "org_1", catalogs: catalog("cat_1") }],
      error: null,
    });

    await selectAccountCatalogs(["acc_1", "org_1"], { catalogIds: ["cat_1"] });

    expect(builder.in).toHaveBeenCalledWith("account", ["acc_1", "org_1"]);
    expect(builder.in).toHaveBeenCalledWith("catalog", ["cat_1"]);
  });

  it("returns an empty list without querying when the catalog filter is empty", async () => {
    const result = await selectAccountCatalogs(["acc_1"], { catalogIds: [] });

    expect(result).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("resolves no organizations itself — a single id queries only that id", async () => {
    const builder = mockBuilder({ data: [], error: null });

    await selectAccountCatalogs(["acc_1"]);

    expect(builder.in).toHaveBeenCalledWith("account", ["acc_1"]);
  });

  it("returns a catalog once when two owner ids both link it, keeping both owners", async () => {
    mockBuilder({
      data: [
        { account: "acc_1", catalogs: catalog("shared") },
        { account: "org_1", catalogs: catalog("shared") },
      ],
      error: null,
    });

    const result = await selectAccountCatalogs(["acc_1", "org_1"]);

    // Both owners matter: the list dedupes the catalog, and the owner shown on
    // a card is picked from this set (chat#1943).
    expect(result).toEqual([{ ...catalog("shared"), owners: ["acc_1", "org_1"] }]);
  });

  it("returns an empty list without querying when given no owner ids", async () => {
    const result = await selectAccountCatalogs([]);

    expect(result).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("throws when the query fails", async () => {
    mockBuilder({ data: null, error: { message: "boom" } });

    await expect(selectAccountCatalogs(["acc_1"])).rejects.toThrow(
      "Failed to fetch account_catalogs: boom",
    );
  });
});
