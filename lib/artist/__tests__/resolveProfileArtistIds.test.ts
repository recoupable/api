import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveProfileArtistIds } from "../resolveProfileArtistIds";
const { socials, links } = vi.hoisted(() => ({ socials: vi.fn(), links: vi.fn() }));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: socials }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: links,
}));
const id = "4Y6lbDkzYvLHs91DVbpeUu";
beforeEach(() => {
  vi.clearAllMocks();
  socials.mockResolvedValue([]);
  links.mockResolvedValue([]);
});
describe("resolveProfileArtistIds", () => {
  it("joins exact Spotify artist IDs across normalized URL variants and deduplicates accounts", async () => {
    socials.mockResolvedValue([
      { id: "a", profile_url: `open.spotify.com/artist/${id}` },
      { id: "b", profile_url: `https://open.spotify.com/artist/${id}?si=test` },
    ]);
    links.mockImplementation(async ({ socialId }) =>
      socialId === "a"
        ? [{ account_id: "current" }, { account_id: "canonical" }]
        : [{ account_id: "canonical" }, { account_id: "second" }],
    );
    expect(
      await resolveProfileArtistIds("current", [`https://open.spotify.com/artist/${id}`]),
    ).toEqual(["current", "canonical", "second"]);
    expect(links).toHaveBeenCalledWith(expect.objectContaining({ socialId: "a" }));
    expect(links).toHaveBeenCalledWith(expect.objectContaining({ socialId: "b" }));
  });
  it("resolves credit accounts beyond the first page of a shared social", async () => {
    socials.mockResolvedValue([{ id: "a", profile_url: `https://open.spotify.com/artist/${id}` }]);
    links.mockImplementation(async ({ offset = 0 }) =>
      offset === 0
        ? Array.from({ length: 100 }, (_, i) => ({ account_id: `account-${i}` }))
        : [{ account_id: "last-account" }],
    );
    const resolved = await resolveProfileArtistIds("current", [
      `https://open.spotify.com/artist/${id}`,
    ]);
    expect(resolved).toHaveLength(102);
    expect(resolved).toContain("last-account");
    expect(links).toHaveBeenCalledWith({ socialId: "a", offset: 100, limit: 100 });
  });
  it("rejects foreign hosts, tracks, ID prefixes and IDs only present in query strings", async () => {
    socials.mockResolvedValue([
      { id: "foreign", profile_url: `https://example.com/artist/${id}` },
      { id: "prefix", profile_url: `https://open.spotify.com/artist/${id}x` },
      { id: "track", profile_url: `https://open.spotify.com/track/${id}` },
      {
        id: "query",
        profile_url: `https://open.spotify.com/artist/6Q192DXotxtaysaqNPy5yR?ref=${id}`,
      },
    ]);
    expect(
      await resolveProfileArtistIds("current", [`https://open.spotify.com/artist/${id}`]),
    ).toEqual(["current"]);
    expect(links).not.toHaveBeenCalled();
  });
  it("does not match names or a spoofed source profile", async () => {
    expect(
      await resolveProfileArtistIds("current", [
        `https://open.spotify.com.evil.test/artist/${id}`,
        "https://instagram.com/thepark",
      ]),
    ).toEqual(["current"]);
    expect(socials).not.toHaveBeenCalled();
  });
  it("retains the original artist if alias resolution fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    socials.mockRejectedValue(new Error("unavailable"));
    expect(
      await resolveProfileArtistIds("current", [`https://open.spotify.com/artist/${id}`]),
    ).toEqual(["current"]);
  });
});
