import { beforeEach, describe, expect, it, vi } from "vitest";

import { insertAccountArtistId } from "../insertAccountArtistId";
import { selectAccountArtistId } from "../selectAccountArtistId";
import { updateAccountArtistPin } from "../updateAccountArtistPin";
import { upsertAccountArtistPin } from "../upsertAccountArtistPin";

vi.mock("../selectAccountArtistId", () => ({
  selectAccountArtistId: vi.fn(),
}));

vi.mock("../updateAccountArtistPin", () => ({
  updateAccountArtistPin: vi.fn(),
}));

vi.mock("../insertAccountArtistId", () => ({
  insertAccountArtistId: vi.fn(),
}));

describe("upsertAccountArtistPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates pinned state when the account/artist row already exists", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue({ artist_id: "artist-456" });

    await upsertAccountArtistPin({
      accountId: "account-123",
      artistId: "artist-456",
      pinned: true,
    });

    expect(updateAccountArtistPin).toHaveBeenCalledWith("account-123", "artist-456", true);
    expect(insertAccountArtistId).not.toHaveBeenCalled();
  });

  it("inserts a row with pinned state when none exists", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);

    await upsertAccountArtistPin({
      accountId: "account-123",
      artistId: "artist-456",
      pinned: false,
    });

    expect(insertAccountArtistId).toHaveBeenCalledWith("account-123", "artist-456", false);
    expect(updateAccountArtistPin).not.toHaveBeenCalled();
  });
});
