import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectSongIdentifiers } from "../selectSongIdentifiers";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

describe("selectSongIdentifiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns identifier rows for a song + platform + type", async () => {
    const rows = [
      { song: "USUYG1069896", platform: "spotify", identifier_type: "album_id", value: "5SKn..." },
    ];
    const eq3 = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eq1 }),
    } as never);

    const result = await selectSongIdentifiers("USUYG1069896", "spotify", "album_id");

    expect(supabase.from).toHaveBeenCalledWith("song_identifiers");
    expect(result).toEqual(rows);
  });

  it("returns [] when none exist or on error", async () => {
    const eq3 = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eq1 }),
    } as never);

    const result = await selectSongIdentifiers("X", "spotify", "album_id");

    expect(result).toEqual([]);
  });
});
