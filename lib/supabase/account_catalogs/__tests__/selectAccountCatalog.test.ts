import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAccountCatalog } from "../selectAccountCatalog";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return { default: { from: mockFrom } };
});

function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {} as never;
  for (const m of ["select", "eq", "in", "limit"]) builder[m] = vi.fn().mockReturnValue(builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

describe("selectAccountCatalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the link row when the catalog belongs to one of the owner ids", async () => {
    const link = { account: "acc_1", catalog: "cat_1" };
    const builder = mockBuilder({ data: link, error: null });

    const result = await selectAccountCatalog({ accountIds: ["acc_1"], catalogId: "cat_1" });

    expect(supabase.from).toHaveBeenCalledWith("account_catalogs");
    expect(builder.in).toHaveBeenCalledWith("account", ["acc_1"]);
    expect(builder.eq).toHaveBeenCalledWith("catalog", "cat_1");
    expect(result).toEqual(link);
  });

  it("matches a catalog owned by one of the account's organizations (chat#1938)", async () => {
    const link = { account: "org_1", catalog: "cat_1" };
    const builder = mockBuilder({ data: link, error: null });

    const result = await selectAccountCatalog({
      accountIds: ["acc_1", "org_1"],
      catalogId: "cat_1",
    });

    expect(builder.in).toHaveBeenCalledWith("account", ["acc_1", "org_1"]);
    expect(result).toEqual(link);
  });

  it("caps the query at one row so a doubly-owned catalog does not error", async () => {
    const builder = mockBuilder({ data: { account: "acc_1", catalog: "cat_1" }, error: null });

    await selectAccountCatalog({ accountIds: ["acc_1", "org_1"], catalogId: "cat_1" });

    expect(builder.limit).toHaveBeenCalledWith(1);
  });

  it("returns null without querying when given no owner ids", async () => {
    const result = await selectAccountCatalog({ accountIds: [], catalogId: "cat_1" });

    expect(result).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns null when no link exists", async () => {
    mockBuilder({ data: null, error: null });

    expect(await selectAccountCatalog({ accountIds: ["acc_1"], catalogId: "cat_x" })).toBeNull();
  });

  it("returns null on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuilder({ data: null, error: { message: "boom" } });

    expect(await selectAccountCatalog({ accountIds: ["acc_1"], catalogId: "cat_1" })).toBeNull();
    consoleError.mockRestore();
  });
});
