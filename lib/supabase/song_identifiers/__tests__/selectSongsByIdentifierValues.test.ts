import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectSongsByIdentifierValues } from "../selectSongsByIdentifierValues";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

describe("selectSongsByIdentifierValues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps external identifier values to songs via reverse lookup", async () => {
    const rows = [
      { song: "USUYG1069896", value: "track_a" },
      { song: "USUYG1069897", value: "track_b" },
    ];
    const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eq2 = vi.fn().mockReturnValue({ in: inFn });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eq1 }),
    } as never);

    const result = await selectSongsByIdentifierValues("spotify", "track_id", [
      "track_a",
      "track_b",
    ]);

    expect(supabase.from).toHaveBeenCalledWith("song_identifiers");
    expect(inFn).toHaveBeenCalledWith("value", ["track_a", "track_b"]);
    expect(result).toEqual(rows);
  });

  it("returns [] for empty input without querying", async () => {
    const result = await selectSongsByIdentifierValues("spotify", "track_id", []);

    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns [] on error", async () => {
    const inFn = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const eq2 = vi.fn().mockReturnValue({ in: inFn });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eq1 }),
    } as never);

    const result = await selectSongsByIdentifierValues("spotify", "track_id", ["x"]);

    expect(result).toEqual([]);
  });
});
