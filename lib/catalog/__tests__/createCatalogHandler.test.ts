import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { createCatalogHandler } from "../createCatalogHandler";
import { validateCreateCatalogBody } from "../validateCreateCatalogBody";
import { createSnapshotCatalog } from "../createSnapshotCatalog";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { selectCatalogById } from "@/lib/supabase/catalogs/selectCatalogById";
import { insertCatalog } from "@/lib/supabase/catalogs/insertCatalog";
import { upsertAccountCatalog } from "@/lib/supabase/account_catalogs/upsertAccountCatalog";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { attachCanonicalArtistToAccount } from "../attachCanonicalArtistToAccount";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("../validateCreateCatalogBody", () => ({ validateCreateCatalogBody: vi.fn() }));
vi.mock("../createSnapshotCatalog", () => ({ createSnapshotCatalog: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots", () => ({
  selectPlaycountSnapshots: vi.fn(),
}));
vi.mock("@/lib/supabase/catalogs/selectCatalogById", () => ({ selectCatalogById: vi.fn() }));
vi.mock("@/lib/supabase/catalogs/insertCatalog", () => ({ insertCatalog: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/upsertAccountCatalog", () => ({
  upsertAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));
vi.mock("../attachCanonicalArtistToAccount", () => ({
  attachCanonicalArtistToAccount: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const otherAccountId = "550e8400-e29b-41d4-a716-446655440999";
const snapshotId = "11111111-2222-3333-4444-555555555555";
const catalogId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const catalog = {
  id: catalogId,
  name: "Bad Bunny — Catalog",
  created_at: "2026-06-18T00:00:00Z",
  updated_at: "2026-06-18T00:00:00Z",
};

const makeRequest = () => new NextRequest("http://localhost/api/catalogs", { method: "POST" });

const okAuth = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });

describe("createCatalogHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits with the validator error and never authenticates", async () => {
    const err = NextResponse.json({ status: "error" }, { status: 400 });
    vi.mocked(validateCreateCatalogBody).mockReturnValue(err);

    const res = await createCatalogHandler(makeRequest());

    expect(res).toBe(err);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("short-circuits with the auth error when unauthenticated", async () => {
    vi.mocked(validateCreateCatalogBody).mockReturnValue({ name: "X" });
    const authErr = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);

    const res = await createCatalogHandler(makeRequest());

    expect(res).toBe(authErr);
    expect(insertCatalog).not.toHaveBeenCalled();
  });

  it("creates an empty catalog from a name-only body and links the account", async () => {
    vi.mocked(validateCreateCatalogBody).mockReturnValue({ name: "Bad Bunny — Catalog" });
    okAuth();
    vi.mocked(insertCatalog).mockResolvedValue(catalog);

    const res = await createCatalogHandler(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(insertCatalog).toHaveBeenCalledWith("Bad Bunny — Catalog");
    expect(upsertAccountCatalog).toHaveBeenCalledWith({ account: accountId, catalog: catalogId });
    expect(body).toEqual({ status: "success", catalog, songs_added: 0 });
    expect(selectPlaycountSnapshots).not.toHaveBeenCalled();
  });

  it("materializes a catalog from an owned, not-yet-claimed snapshot", async () => {
    vi.mocked(validateCreateCatalogBody).mockReturnValue({
      name: "Bad Bunny — Catalog",
      snapshot: snapshotId,
    });
    okAuth();
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      { id: snapshotId, account: accountId, catalog: null, isrcs: ["A", "B"] } as never,
    ]);
    vi.mocked(createSnapshotCatalog).mockResolvedValue({ catalog, songsAdded: 2 });

    const res = await createCatalogHandler(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(createSnapshotCatalog).toHaveBeenCalledWith({
      accountId,
      snapshot: expect.objectContaining({ id: snapshotId }),
      name: "Bad Bunny — Catalog",
    });
    expect(body).toEqual({ status: "success", catalog, songs_added: 2 });
  });

  it("returns 404 when the snapshot does not exist", async () => {
    vi.mocked(validateCreateCatalogBody).mockReturnValue({ snapshot: snapshotId });
    okAuth();
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([]);

    const res = await createCatalogHandler(makeRequest());

    expect(res.status).toBe(404);
    expect(createSnapshotCatalog).not.toHaveBeenCalled();
  });

  it("returns 403 when the snapshot belongs to a different account", async () => {
    vi.mocked(validateCreateCatalogBody).mockReturnValue({ snapshot: snapshotId });
    okAuth();
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      { id: snapshotId, account: otherAccountId, catalog: null, isrcs: ["A"] } as never,
    ]);

    const res = await createCatalogHandler(makeRequest());

    expect(res.status).toBe(403);
    expect(createSnapshotCatalog).not.toHaveBeenCalled();
  });

  it("is idempotent: returns the existing catalog when the snapshot is already claimed", async () => {
    vi.mocked(validateCreateCatalogBody).mockReturnValue({ snapshot: snapshotId });
    okAuth();
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      { id: snapshotId, account: accountId, catalog: catalogId, isrcs: ["A", "B"] } as never,
    ]);
    vi.mocked(selectCatalogById).mockResolvedValue(catalog);
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);

    const res = await createCatalogHandler(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(selectCatalogById).toHaveBeenCalledWith(catalogId);
    expect(createSnapshotCatalog).not.toHaveBeenCalled();
    expect(body).toEqual({ status: "success", catalog, songs_added: 0 });
  });

  it("re-claims link the caller's account so the report can read measurements", async () => {
    // Regression: the re-claim branch returned the existing catalog without an
    // account_catalogs link, so a reader whose account differed from the
    // original claimer (account divergence / prior double-account race) got a
    // report 404 — getCatalogMeasurementsHandler 404s on a missing link.
    vi.mocked(validateCreateCatalogBody).mockReturnValue({ snapshot: snapshotId });
    okAuth();
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      { id: snapshotId, account: accountId, catalog: catalogId, isrcs: ["A"] } as never,
    ]);
    vi.mocked(selectCatalogById).mockResolvedValue(catalog);
    vi.mocked(selectSongMeasurements).mockResolvedValue([]);

    const res = await createCatalogHandler(makeRequest());

    expect(res.status).toBe(200);
    expect(upsertAccountCatalog).toHaveBeenCalledWith({ account: accountId, catalog: catalogId });
  });

  it("re-claims still attach the canonical artist to the roster (chat#1850 P1)", async () => {
    vi.mocked(validateCreateCatalogBody).mockReturnValue({ snapshot: snapshotId });
    okAuth();
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      { id: snapshotId, account: accountId, catalog: catalogId, isrcs: null } as never,
    ]);
    vi.mocked(selectCatalogById).mockResolvedValue(catalog);
    vi.mocked(selectSongMeasurements).mockResolvedValue([
      { song: "ISRC_A" } as never,
      { song: "ISRC_A" } as never,
      { song: "ISRC_B" } as never,
    ]);

    const res = await createCatalogHandler(makeRequest());

    expect(res.status).toBe(200);
    expect(selectSongMeasurements).toHaveBeenCalledWith({ snapshot: snapshotId });
    expect(attachCanonicalArtistToAccount).toHaveBeenCalledWith({
      accountId,
      isrcs: ["ISRC_A", "ISRC_B"],
    });
  });

  it("returns a generic 500 without leaking the underlying error", async () => {
    vi.mocked(validateCreateCatalogBody).mockReturnValue({ name: "X" });
    okAuth();
    vi.mocked(insertCatalog).mockRejectedValue(new Error("db down at 10.0.0.1:5432"));

    const res = await createCatalogHandler(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.status).toBe("error");
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });
});
