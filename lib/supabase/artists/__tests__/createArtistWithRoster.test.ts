import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArtistWithRoster } from "../createArtistWithRoster";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));

describe("createArtistWithRoster", () => {
  beforeEach(() => vi.resetAllMocks());

  it("preserves the legacy response timestamps after an atomic creation", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "artist",
        account_id: "artist",
        timestamp: 1700000000000,
        account_info: [{ updated_at: "2026-10-08T00:00:00Z" }],
        account_socials: [],
      },
      error: null,
    });
    const result = await createArtistWithRoster("Name", "actor", "org");
    expect(rpc).toHaveBeenCalledWith("create_artist_with_roster", {
      p_name: "Name",
      p_account_id: "actor",
      p_organization_id: "org",
    });
    expect(result).toMatchObject({
      created_at: "2023-11-14T22:13:20.000Z",
      updated_at: "2026-10-08T00:00:00Z",
      account_id: "artist",
    });
  });

  it.each([
    { data: null, error: { message: "private details" } },
    { data: null, error: null },
  ])("fails closed without exposing database details", async response => {
    rpc.mockResolvedValue(response);
    await expect(createArtistWithRoster("Name", "actor")).rejects.toThrow(
      "Could not create artist. Please retry.",
    );
    expect(rpc).toHaveBeenCalledWith("create_artist_with_roster", {
      p_name: "Name",
      p_account_id: "actor",
      p_organization_id: null,
    });
  });
});
