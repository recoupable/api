import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSnapshotCatalog } from "../createSnapshotCatalog";
import { insertCatalog } from "@/lib/supabase/catalogs/insertCatalog";
import { upsertAccountCatalog } from "@/lib/supabase/account_catalogs/upsertAccountCatalog";
import { insertCatalogSongs } from "@/lib/supabase/catalog_songs/insertCatalogSongs";
import { updatePlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/updatePlaycountSnapshot";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { attachCanonicalArtistToAccount } from "../attachCanonicalArtistToAccount";

vi.mock("@/lib/supabase/catalogs/insertCatalog", () => ({ insertCatalog: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/upsertAccountCatalog", () => ({
  upsertAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_songs/insertCatalogSongs", () => ({ insertCatalogSongs: vi.fn() }));
vi.mock("@/lib/supabase/playcount_snapshots/updatePlaycountSnapshot", () => ({
  updatePlaycountSnapshot: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));
vi.mock("../attachCanonicalArtistToAccount", () => ({
  attachCanonicalArtistToAccount: vi.fn(),
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
    expect(upsertAccountCatalog).toHaveBeenCalledWith({ account: accountId, catalog: catalogId });
    // ISRCs come from measurements by snapshot, NOT snapshot.isrcs (null here)
    expect(selectSongMeasurements).toHaveBeenCalledWith({ snapshot: snapshotId });
    expect(insertCatalogSongs).toHaveBeenCalledWith([
      { catalog: catalogId, song: "ISRC_A" },
      { catalog: catalogId, song: "ISRC_B" },
      { catalog: catalogId, song: "ISRC_C" },
    ]);
    expect(updatePlaycountSnapshot).toHaveBeenCalledWith(snapshotId, { catalog: catalogId });
    expect(result).toEqual({ catalog, songsAdded: 3 });
  });

  it("attaches the canonical artist for the measured ISRCs to the claiming account (chat#1850 P1)", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([
      measurement("ISRC_A"),
      measurement("ISRC_B"),
    ]);

    await createSnapshotCatalog({ accountId, snapshot });

    expect(attachCanonicalArtistToAccount).toHaveBeenCalledWith({
      accountId,
      isrcs: ["ISRC_A", "ISRC_B"],
    });
  });

  it("skips the canonical-artist attach when the snapshot has no measurements", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);

    await createSnapshotCatalog({ accountId, snapshot });

    expect(attachCanonicalArtistToAccount).not.toHaveBeenCalled();
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
    expect(result).toEqual({ catalog, songsAdded: 2 });
  });

  it("adds no songs when the snapshot has no measurements", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);

    const result = await createSnapshotCatalog({ accountId, snapshot });

    expect(insertCatalogSongs).not.toHaveBeenCalled();
    expect(updatePlaycountSnapshot).toHaveBeenCalledWith(snapshotId, { catalog: catalogId });
    expect(result).toEqual({ catalog, songsAdded: 0 });
  });

  it("falls back to a default name when none is supplied", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);

    await createSnapshotCatalog({ accountId, snapshot });

    expect(insertCatalog).toHaveBeenCalledWith("Valuation Catalog");
  });
});
