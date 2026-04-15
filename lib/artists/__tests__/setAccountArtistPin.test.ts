import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/account_artist_ids/selectAccountArtistId", () => ({
  selectAccountArtistId: vi.fn(),
}));
vi.mock("@/lib/supabase/account_artist_ids/updateAccountArtistPinById", () => ({
  updateAccountArtistPinById: vi.fn(),
}));
vi.mock("@/lib/supabase/account_artist_ids/insertAccountArtistId", () => ({
  insertAccountArtistId: vi.fn(),
}));

import { setAccountArtistPin } from "../setAccountArtistPin";
import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
import { updateAccountArtistPinById } from "@/lib/supabase/account_artist_ids/updateAccountArtistPinById";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";

const ACCOUNT_ID = "acc-1";
const ARTIST_ID = "artist-1";

describe("setAccountArtistPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates by id when a row already exists", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue({
      id: "row-123",
      artist_id: ARTIST_ID,
      pinned: false,
    } as never);

    await setAccountArtistPin({ accountId: ACCOUNT_ID, artistId: ARTIST_ID, pinned: true });

    expect(updateAccountArtistPinById).toHaveBeenCalledWith("row-123", true);
    expect(insertAccountArtistId).not.toHaveBeenCalled();
  });

  it("inserts a new row with pinned state when no row exists", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);

    await setAccountArtistPin({ accountId: ACCOUNT_ID, artistId: ARTIST_ID, pinned: true });

    expect(insertAccountArtistId).toHaveBeenCalledWith(ACCOUNT_ID, ARTIST_ID, { pinned: true });
    expect(updateAccountArtistPinById).not.toHaveBeenCalled();
  });
});
