import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCatalogPlaycountHistory } from "../getCatalogPlaycountHistory";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogRecordingPage } from "@/lib/supabase/catalog_songs/selectCatalogRecordingPage";
import { selectPublicPlaycountHistory } from "@/lib/supabase/song_measurements/selectPublicPlaycountHistory";

vi.mock("../getCatalogOwnerIds", () => ({
  getCatalogOwnerIds: vi.fn(async () => ["owner", "org"]),
}));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogRecordingPage", () => ({
  selectCatalogRecordingPage: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectPublicPlaycountHistory", () => ({
  selectPublicPlaycountHistory: vi.fn(),
}));
const query = {
  catalog_id: "740d5050-40ec-4892-a040-b78bb50fef2f",
  since: "2026-09-03",
  days: 2,
  page: 1,
  limit: 25,
};

describe("getCatalogPlaycountHistory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(selectAccountCatalog).mockResolvedValue({ account: "org" } as never);
    vi.mocked(selectCatalogRecordingPage).mockResolvedValue({
      songs: [{ isrc: "TEST00000001", name: "Synthetic" }],
      total_count: 2,
    });
    vi.mocked(selectPublicPlaycountHistory).mockResolvedValue([]);
  });
  it("checks catalog access before reading songs or history", async () => {
    vi.mocked(selectAccountCatalog).mockResolvedValue(null);
    expect(await getCatalogPlaycountHistory("owner", query)).toMatchObject({ status: 404 });
    expect(selectCatalogRecordingPage).not.toHaveBeenCalled();
    expect(selectPublicPlaycountHistory).not.toHaveBeenCalled();
  });
  it("reads current catalog membership, keeps unmeasured recordings and labels page scope", async () => {
    const result = await getCatalogPlaycountHistory("owner", query);
    expect(selectAccountCatalog).toHaveBeenCalledWith({
      accountIds: ["owner", "org"],
      catalogId: query.catalog_id,
      throwOnError: true,
    });
    expect(result).toMatchObject({
      data: {
        summary_scope: "page",
        collection_enabled: false,
        pagination: { total_count: 2 },
        recordings: [{ isrc: "TEST00000001", state: "incomplete" }],
      },
    });
  });
  it("rejects future and unfinished observation periods", async () => {
    expect(
      await getCatalogPlaycountHistory("owner", { ...query, since: "2099-01-01" }),
    ).toMatchObject({ status: 400 });
    expect(selectPublicPlaycountHistory).not.toHaveBeenCalled();
  });
  it("propagates database failures rather than manufacturing missing history", async () => {
    vi.mocked(selectPublicPlaycountHistory).mockRejectedValue(new Error("database unavailable"));
    await expect(getCatalogPlaycountHistory("owner", query)).rejects.toThrow(
      "database unavailable",
    );
  });
  it("does not read unrelated recordings or private analytics", async () => {
    await getCatalogPlaycountHistory("owner", query);
    expect(selectPublicPlaycountHistory).toHaveBeenCalledWith({
      song: "TEST00000001",
      since: "2026-09-01",
      until: "2026-09-05",
    });
  });
});
