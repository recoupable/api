import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSnapshotCatalog } from "../createSnapshotCatalog";
import { insertCatalog } from "@/lib/supabase/catalogs/insertCatalog";
import { insertAccountCatalog } from "@/lib/supabase/account_catalogs/insertAccountCatalog";
import { insertCatalogSongs } from "@/lib/supabase/catalog_songs/insertCatalogSongs";
import { updatePlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/updatePlaycountSnapshot";
import { selectSnapshotIsrcs } from "@/lib/supabase/song_measurements/selectSnapshotIsrcs";

vi.mock("@/lib/supabase/catalogs/insertCatalog", () => ({ insertCatalog: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/insertAccountCatalog", () => ({
  insertAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_songs/insertCatalogSongs", () => ({ insertCatalogSongs: vi.fn() }));
vi.mock("@/lib/supabase/playcount_snapshots/updatePlaycountSnapshot", () => ({
  updatePlaycountSnapshot: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectSnapshotIsrcs", () => ({
  selectSnapshotIsrcs: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const snapshotId = "11111111-2222-3333-4444-555555555555";
const catalogId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const catalog = { id: catalogId, name: "Bad Bunny Catalog", created_at: "t", updated_at: "t" };
// A real valuation snapshot is scoped by album_ids, so its own `isrcs` column is null —
// the measured ISRCs live in song_measurements (sourced via selectSnapshotIsrcs).
const snapshot = { id: snapshotId, account: accountId, catalog: null, isrcs: null } as never;

describe("createSnapshotCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(insertCatalog).mockResolvedValue(catalog);
  });

  it("sources measured ISRCs from song_measurements and adds them as catalog songs", async () => {
    vi.mocked(selectSnapshotIsrcs).mockResolvedValue(["ISRC_A", "ISRC_B", "ISRC_C"]);

    const result = await createSnapshotCatalog({ accountId, snapshot, name: "Bad Bunny Catalog" });

    expect(insertCatalog).toHaveBeenCalledWith("Bad Bunny Catalog");
    expect(insertAccountCatalog).toHaveBeenCalledWith({ account: accountId, catalog: catalogId });
    // ISRCs come from measurements, NOT snapshot.isrcs (which is null here)
    expect(selectSnapshotIsrcs).toHaveBeenCalledWith(snapshotId);
    expect(insertCatalogSongs).toHaveBeenCalledWith([
      { catalog: catalogId, song: "ISRC_A" },
      { catalog: catalogId, song: "ISRC_B" },
      { catalog: catalogId, song: "ISRC_C" },
    ]);
    expect(updatePlaycountSnapshot).toHaveBeenCalledWith(snapshotId, { catalog: catalogId });
    expect(result).toEqual({ catalog, songsAdded: 3 });
  });

  it("adds no songs when the snapshot has no measurements", async () => {
    vi.mocked(selectSnapshotIsrcs).mockResolvedValue([]);

    const result = await createSnapshotCatalog({ accountId, snapshot });

    expect(insertCatalogSongs).not.toHaveBeenCalled();
    expect(updatePlaycountSnapshot).toHaveBeenCalledWith(snapshotId, { catalog: catalogId });
    expect(result).toEqual({ catalog, songsAdded: 0 });
  });

  it("falls back to a default name when none is supplied", async () => {
    vi.mocked(selectSnapshotIsrcs).mockResolvedValue([]);

    await createSnapshotCatalog({ accountId, snapshot });

    expect(insertCatalog).toHaveBeenCalledWith("Valuation Catalog");
  });
});
