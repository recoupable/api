import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveClaimedCatalog } from "../resolveClaimedCatalog";
import { selectCatalogById } from "@/lib/supabase/catalogs/selectCatalogById";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { createSnapshotCatalog } from "../createSnapshotCatalog";

vi.mock("@/lib/supabase/catalogs/selectCatalogById", () => ({ selectCatalogById: vi.fn() }));
vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));
vi.mock("../createSnapshotCatalog", () => ({ createSnapshotCatalog: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const snapshot = (over: Record<string, unknown>) =>
  ({ id: "snap_1", account: accountId, catalog: null, ...over }) as never;

describe("resolveClaimedCatalog", () => {
  beforeEach(() => vi.clearAllMocks());

  // chat#1967: a re-run whose snapshot is already claimed must reuse the
  // existing catalog, never mint a second one.
  it("reuses the existing catalog for an already-claimed snapshot", async () => {
    vi.mocked(selectCatalogById).mockResolvedValue({ id: "cat_1", name: "X" } as never);
    vi.mocked(selectSongMeasurements).mockResolvedValue([
      { song: "ISRC_A" } as never,
      { song: "ISRC_A" } as never,
    ]);

    const result = await resolveClaimedCatalog({
      accountId,
      ownerId: accountId,
      snapshot: snapshot({ catalog: "cat_1" }),
    });

    expect(createSnapshotCatalog).not.toHaveBeenCalled();
    expect(result.catalog.id).toBe("cat_1");
    expect(result.songsAdded).toBe(0);
    expect(result.isrcs).toEqual(["ISRC_A"]);
  });

  it("materializes a new catalog for an unclaimed snapshot", async () => {
    vi.mocked(createSnapshotCatalog).mockResolvedValue({
      catalog: { id: "cat_new" } as never,
      songsAdded: 3,
      isrcs: ["A", "B", "C"],
    });

    const result = await resolveClaimedCatalog({
      accountId,
      ownerId: accountId,
      snapshot: snapshot({}),
      name: "Fresh",
    });

    expect(selectCatalogById).not.toHaveBeenCalled();
    expect(result.catalog.id).toBe("cat_new");
    expect(result.songsAdded).toBe(3);
  });

  it("materializes fresh when the claimed catalog row no longer exists", async () => {
    vi.mocked(selectCatalogById).mockResolvedValue(null);
    vi.mocked(createSnapshotCatalog).mockResolvedValue({
      catalog: { id: "cat_new" } as never,
      songsAdded: 1,
      isrcs: ["A"],
    });

    const result = await resolveClaimedCatalog({
      accountId,
      ownerId: accountId,
      snapshot: snapshot({ catalog: "cat_gone" }),
    });

    expect(result.catalog.id).toBe("cat_new");
  });
});
