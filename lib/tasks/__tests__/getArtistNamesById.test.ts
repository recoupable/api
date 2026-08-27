import { describe, it, expect, vi, beforeEach } from "vitest";
import { getArtistNamesById } from "@/lib/tasks/getArtistNamesById";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: vi.fn() }));

describe("getArtistNamesById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps each artist account id to its display name in one batched select", async () => {
    vi.mocked(selectAccounts).mockResolvedValue([
      { id: "art-1", name: "Braden Bales" },
      { id: "art-2", name: null },
    ] as never);
    const names = await getArtistNamesById(["art-1", "art-2", "art-1"]);
    expect(selectAccounts).toHaveBeenCalledWith(["art-1", "art-2"]);
    expect(names.get("art-1")).toBe("Braden Bales");
    expect(names.get("art-2")).toBeNull();
    expect(names.has("art-9")).toBe(false);
  });

  it("returns an empty map (never throws) when the lookup fails, so tasks still load", async () => {
    vi.mocked(selectAccounts).mockRejectedValue(new Error("supabase down"));
    const names = await getArtistNamesById(["art-1"]);
    expect(names.size).toBe(0);
  });

  it("skips the select entirely for an empty id list", async () => {
    const names = await getArtistNamesById([]);
    expect(selectAccounts).not.toHaveBeenCalled();
    expect(names.size).toBe(0);
  });
});
