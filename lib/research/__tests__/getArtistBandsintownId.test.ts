import { describe, it, expect, vi, beforeEach } from "vitest";
import { getArtistBandsintownId } from "../getArtistBandsintownId";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";

vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));

function socials(...urls: (string | null)[]) {
  return urls.map((profile_url, i) => ({
    id: `as-${i}`,
    account_id: "artist-1",
    social_id: `s-${i}`,
    social: profile_url === null ? null : { id: `s-${i}`, profile_url },
  }));
}

describe("getArtistBandsintownId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts the numeric id from a bandsintown profile url", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue(
      socials(
        "https://open.spotify.com/artist/abc",
        "https://www.bandsintown.com/a/1590132-loreen",
      ) as never,
    );

    await expect(getArtistBandsintownId("artist-1")).resolves.toBe("1590132");
    expect(selectAccountSocials).toHaveBeenCalledWith({ accountId: "artist-1" });
  });

  it("matches without the www subdomain and with a trailing path or query", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue(
      socials("https://bandsintown.com/a/15056420-m-huncho?came_from=257") as never,
    );

    await expect(getArtistBandsintownId("artist-1")).resolves.toBe("15056420");
  });

  // profile_url is lowercased by a DB trigger, so matching must be case-insensitive.
  it("matches case-insensitively", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue(
      socials("HTTPS://WWW.BANDSINTOWN.COM/A/66728-MICKY") as never,
    );

    await expect(getArtistBandsintownId("artist-1")).resolves.toBe("66728");
  });

  it("returns null when the artist has no bandsintown social", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue(
      socials("https://open.spotify.com/artist/abc", "https://instagram.com/foo") as never,
    );

    await expect(getArtistBandsintownId("artist-1")).resolves.toBeNull();
  });

  it("returns null when the artist has no socials at all", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue([] as never);

    await expect(getArtistBandsintownId("artist-1")).resolves.toBeNull();
  });

  it("ignores a bandsintown url that carries no numeric id", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue(
      socials("https://www.bandsintown.com/a/loreen") as never,
    );

    await expect(getArtistBandsintownId("artist-1")).resolves.toBeNull();
  });

  it("tolerates rows with a null joined social", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue(
      socials(null, "https://www.bandsintown.com/a/2459-sandi-thom") as never,
    );

    await expect(getArtistBandsintownId("artist-1")).resolves.toBe("2459");
  });
});
