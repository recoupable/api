import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/account_info/selectAccountInfo", () => ({
  selectAccountInfo: vi.fn(),
}));
vi.mock("@/lib/supabase/account_info/insertAccountInfo", () => ({
  insertAccountInfo: vi.fn(),
}));
vi.mock("@/lib/supabase/account_info/updateAccountInfo", () => ({
  updateAccountInfo: vi.fn(),
}));

import { upsertArtistInfoFields } from "../upsertArtistInfoFields";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import { updateAccountInfo } from "@/lib/supabase/account_info/updateAccountInfo";

const ARTIST_ID = "artist-1";

describe("upsertArtistInfoFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts when no existing account_info row exists", async () => {
    vi.mocked(selectAccountInfo).mockResolvedValue(null);

    await upsertArtistInfoFields({
      artistId: ARTIST_ID,
      image: "https://cdn/img.png",
      instruction: "be chill",
      label: "indie",
      knowledges: [{ url: "u1", name: "n1", type: "text/plain" }],
    });

    expect(insertAccountInfo).toHaveBeenCalledWith({
      account_id: ARTIST_ID,
      image: "https://cdn/img.png",
      instruction: "be chill",
      knowledges: [{ url: "u1", name: "n1", type: "text/plain" }],
      label: "indie",
    });
    expect(updateAccountInfo).not.toHaveBeenCalled();
  });

  it("treats empty-string label as null on insert", async () => {
    vi.mocked(selectAccountInfo).mockResolvedValue(null);

    await upsertArtistInfoFields({ artistId: ARTIST_ID, label: "" });

    expect(insertAccountInfo).toHaveBeenCalledWith(
      expect.objectContaining({ label: null }),
    );
  });

  it("updates and preserves existing fields when callers omit them", async () => {
    vi.mocked(selectAccountInfo).mockResolvedValue({
      image: "old-img",
      instruction: "old instr",
      knowledges: [{ url: "old", name: "old", type: "text/plain" }],
      label: "old-label",
    } as never);

    await upsertArtistInfoFields({ artistId: ARTIST_ID, image: "new-img" });

    expect(updateAccountInfo).toHaveBeenCalledWith(ARTIST_ID, {
      image: "new-img",
      instruction: "old instr",
      knowledges: [{ url: "old", name: "old", type: "text/plain" }],
      label: "old-label",
    });
    expect(insertAccountInfo).not.toHaveBeenCalled();
  });

  it("de-duplicates knowledges by url on update", async () => {
    vi.mocked(selectAccountInfo).mockResolvedValue({
      image: null,
      instruction: null,
      knowledges: [],
      label: null,
    } as never);

    await upsertArtistInfoFields({
      artistId: ARTIST_ID,
      knowledges: [
        { url: "u1", name: "first", type: "text/plain" },
        { url: "u1", name: "dup", type: "text/plain" },
        { url: "u2", name: "n2", type: "text/plain" },
      ],
    });

    expect(updateAccountInfo).toHaveBeenCalledWith(
      ARTIST_ID,
      expect.objectContaining({
        knowledges: [
          { url: "u1", name: "dup", type: "text/plain" },
          { url: "u2", name: "n2", type: "text/plain" },
        ],
      }),
    );
  });

  it("treats empty-string label as null on update", async () => {
    vi.mocked(selectAccountInfo).mockResolvedValue({
      image: null,
      instruction: null,
      knowledges: [],
      label: "old",
    } as never);

    await upsertArtistInfoFields({ artistId: ARTIST_ID, label: "" });

    expect(updateAccountInfo).toHaveBeenCalledWith(
      ARTIST_ID,
      expect.objectContaining({ label: null }),
    );
  });
});
