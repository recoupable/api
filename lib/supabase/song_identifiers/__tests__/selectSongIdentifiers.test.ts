import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectSongIdentifiers } from "../selectSongIdentifiers";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (v: unknown) => void) => void;
  } = {} as never;
  for (const method of ["select", "eq", "in"]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.then = resolve => resolve(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

describe("selectSongIdentifiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forward lookup: filters by song + platform + identifier type", async () => {
    const rows = [
      {
        song: "USA2P2015959",
        platform: "spotify",
        identifier_type: "album_id",
        value: "70Zkfb99ladZ3q0JVg97co",
      },
    ];
    const builder = mockBuilder({ data: rows, error: null });

    const result = await selectSongIdentifiers({
      song: "USA2P2015959",
      platform: "spotify",
      identifierType: "album_id",
    });

    expect(supabase.from).toHaveBeenCalledWith("song_identifiers");
    expect(builder.select).toHaveBeenCalledWith("song, platform, identifier_type, value");
    expect(builder.eq).toHaveBeenCalledWith("platform", "spotify");
    expect(builder.eq).toHaveBeenCalledWith("identifier_type", "album_id");
    expect(builder.eq).toHaveBeenCalledWith("song", "USA2P2015959");
    expect(builder.in).not.toHaveBeenCalled();
    expect(result).toEqual(rows);
  });

  it("reverse lookup: filters by identifier values", async () => {
    const rows = [
      { song: "USA2P2015959", platform: "spotify", identifier_type: "track_id", value: "track_a" },
    ];
    const builder = mockBuilder({ data: rows, error: null });

    const result = await selectSongIdentifiers({
      platform: "spotify",
      identifierType: "track_id",
      values: ["track_a", "track_b"],
    });

    expect(builder.in).toHaveBeenCalledWith("value", ["track_a", "track_b"]);
    expect(builder.eq).toHaveBeenCalledWith("platform", "spotify");
    expect(builder.eq).toHaveBeenCalledWith("identifier_type", "track_id");
    expect(result).toEqual(rows);
  });

  it("filters by a songs[] batch (all identifier rows for an album's tracks)", async () => {
    const rows = [
      { song: "USA2P2015959", platform: "spotify", identifier_type: "track_id", value: "t1" },
    ];
    const builder = mockBuilder({ data: rows, error: null });

    const result = await selectSongIdentifiers({
      platform: "spotify",
      identifierType: "track_id",
      songs: ["USA2P2015959", "USUYG1069897"],
    });

    expect(builder.in).toHaveBeenCalledWith("song", ["USA2P2015959", "USUYG1069897"]);
    expect(result).toEqual(rows);
  });

  it("returns [] for an empty values array without querying", async () => {
    const result = await selectSongIdentifiers({
      platform: "spotify",
      identifierType: "track_id",
      values: [],
    });

    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns [] and logs on query error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuilder({ data: null, error: { message: "boom" } });

    const result = await selectSongIdentifiers({
      song: "X",
      platform: "spotify",
      identifierType: "album_id",
    });

    expect(result).toEqual([]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
