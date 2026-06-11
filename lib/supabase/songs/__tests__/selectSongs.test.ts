import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectSongs } from "../selectSongs";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

describe("selectSongs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects songs by ISRC list", async () => {
    const rows = [{ isrc: "USA2P2015959", name: "The Spins", album: "K.I.D.S. (Deluxe)" }];
    const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ in: inFn }),
    } as never);

    const result = await selectSongs(["USA2P2015959"]);

    expect(supabase.from).toHaveBeenCalledWith("songs");
    expect(inFn).toHaveBeenCalledWith("isrc", ["USA2P2015959"]);
    expect(result).toEqual(rows);
  });

  it("returns [] for empty input without querying", async () => {
    const result = await selectSongs([]);

    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns [] on query error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const inFn = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ in: inFn }),
    } as never);

    const result = await selectSongs(["X"]);

    expect(result).toEqual([]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
