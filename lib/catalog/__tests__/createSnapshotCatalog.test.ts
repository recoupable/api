import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSnapshotCatalog } from "../createSnapshotCatalog";
import { insertCatalog } from "@/lib/supabase/catalogs/insertCatalog";
import { insertAccountCatalog } from "@/lib/supabase/account_catalogs/insertAccountCatalog";
import { insertCatalogSongs } from "@/lib/supabase/catalog_songs/insertCatalogSongs";
import { updatePlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/updatePlaycountSnapshot";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";

vi.mock("@/lib/supabase/catalogs/insertCatalog", () => ({ insertCatalog: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/insertAccountCatalog", () => ({
  insertAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_songs/insertCatalogSongs", () => ({ insertCatalogSongs: vi.fn() }));
vi.mock("@/lib/supabase/playcount_snapshots/updatePlaycountSnapshot", () => ({
  updatePlaycountSnapshot: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const snapshotId = "11111111-2222-3333-4444-555555555555";
const catalogId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const catalog = { id: catalogId, name: "Bad Bunny Catalog", created_at: "t", updated_at: "t" };
// A real valuation snapshot is scoped by album_ids, so its own `isrcs` column is null —
// the measured ISRCs live in song_measurements (sourced via selectSongMeasurements).
const snapshot = { id: snapshotId, account: accountId, catalog: null, isrcs: null } as never;
const measurement = (song: string) => ({ song }) as never;

describe("createSnapshotCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(insertCatalog).mockResolvedValue(catalog);
  });

  it("sources measured ISRCs from song_measurements (by snapshot) and adds them as catalog songs", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([
      measurement("ISRC_A"),
      measurement("ISRC_B"),
      measurement("ISRC_C"),
    ]);

    const result = await createSnapshotCatalog({ accountId, snapshot, name: "Bad Bunny Catalog" });

    expect(insertCatalog).toHaveBeenCalledWith("Bad Bunny Catalog");
    expect(insertAccountCatalog).toHaveBeenCalledWith({ account: accountId, catalog: catalogId });
    // ISRCs come from measurements by snapshot, NOT snapshot.isrcs (null here)
    expect(selectSongMeasurements).toHaveBeenCalledWith({ snapshot: snapshotId });
    expect(insertCatalogSongs).toHaveBeenCalledWith([
      { catalog: catalogId, song: "ISRC_A" },
      { catalog: catalogId, song: "ISRC_B" },
      { catalog: catalogId, song: "ISRC_C" },
    ]);
    expect(updatePlaycountSnapshot).toHaveBeenCalledWith(snapshotId, { catalog: catalogId });
    // The return surfaces the measured ISRCs so the calling surface can run —
    // and own the failure policy of — the roster attach (chat#1965).
    expect(result).toEqual({ catalog, songsAdded: 3, isrcs: ["ISRC_A", "ISRC_B", "ISRC_C"] });
  });

  it("dedupes ISRCs across multiple measurement rows per track", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([
      measurement("ISRC_A"),
      measurement("ISRC_A"),
      measurement("ISRC_B"),
    ]);

    const result = await createSnapshotCatalog({ accountId, snapshot });

    expect(insertCatalogSongs).toHaveBeenCalledWith([
      { catalog: catalogId, song: "ISRC_A" },
      { catalog: catalogId, song: "ISRC_B" },
    ]);
    expect(result).toEqual({ catalog, songsAdded: 2, isrcs: ["ISRC_A", "ISRC_B"] });
  });

  it("adds no songs when the snapshot has no measurements", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);

    const result = await createSnapshotCatalog({ accountId, snapshot });

    expect(insertCatalogSongs).not.toHaveBeenCalled();
    expect(updatePlaycountSnapshot).toHaveBeenCalledWith(snapshotId, { catalog: catalogId });
    expect(result).toEqual({ catalog, songsAdded: 0, isrcs: [] });
  });

  it("falls back to a default name when none is supplied", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);

    await createSnapshotCatalog({ accountId, snapshot });

    expect(insertCatalog).toHaveBeenCalledWith("Valuation Catalog");
  });

  it("links the catalog to ownerId when one is given (chat#1938)", async () => {
    const orgId = "7f9c1e2a-3b4d-4c5e-8f60-1a2b3c4d5e6f";
    vi.mocked(selectSongMeasurements).mockResolvedValue([measurement("ISRC_A")]);

    await createSnapshotCatalog({ accountId, ownerId: orgId, snapshot, name: "Org Catalog" });

    expect(insertAccountCatalog).toHaveBeenCalledWith({ account: orgId, catalog: catalogId });
  });

  it("defaults the owner to accountId when ownerId is omitted", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([measurement("ISRC_A")]);

    await createSnapshotCatalog({ accountId, snapshot, name: "Personal Catalog" });

    expect(insertAccountCatalog).toHaveBeenCalledWith({ account: accountId, catalog: catalogId });
  });
});
