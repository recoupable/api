import { beforeEach, describe, expect, it, vi } from "vitest";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { getRepoFileTree } from "@/lib/github/getRepoFileTree";

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

vi.mock("@/lib/github/getRepoFileTree", () => ({
  getRepoFileTree: vi.fn(),
}));

describe("getArtistContentReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        github_repo: "https://github.com/test-org/test-repo",
      },
    ] as never);
  });

  it("returns ready=true when required files exist", async () => {
    vi.mocked(getRepoFileTree).mockResolvedValue([
      { path: "artists/gatsby-grace/context/images/face-guide.png", type: "blob", sha: "1" },
      { path: "artists/gatsby-grace/config/content-creation/config.json", type: "blob", sha: "2" },
      { path: "artists/gatsby-grace/songs/song-a.mp3", type: "blob", sha: "3" },
      { path: "artists/gatsby-grace/context/artist.md", type: "blob", sha: "4" },
      { path: "artists/gatsby-grace/context/audience.md", type: "blob", sha: "5" },
      { path: "artists/gatsby-grace/context/era.json", type: "blob", sha: "6" },
    ]);

    const result = await getArtistContentReadiness({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
    });

    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("returns ready=false with required issues when core files are missing", async () => {
    vi.mocked(getRepoFileTree).mockResolvedValue([
      { path: "artists/gatsby-grace/context/artist.md", type: "blob", sha: "1" },
    ]);

    const result = await getArtistContentReadiness({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
    });

    expect(result.ready).toBe(false);
    expect(result.missing.some(item => item.file === "context/images/face-guide.png")).toBe(true);
    expect(result.missing.some(item => item.file === "songs/*.mp3")).toBe(true);
  });

  it("returns ready=true when only face-guide and mp3 exist (config.json is optional)", async () => {
    vi.mocked(getRepoFileTree).mockResolvedValue([
      { path: "artists/gatsby-grace/context/images/face-guide.png", type: "blob", sha: "1" },
      { path: "artists/gatsby-grace/songs/track.mp3", type: "blob", sha: "2" },
    ]);

    const result = await getArtistContentReadiness({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
    });

    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
    // config.json appears as a warning, not a blocker
    expect(result.warnings.some(item => item.file === "config/content-creation/config.json")).toBe(true);
  });

  it("throws when account has no github repo", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([] as never);

    await expect(
      getArtistContentReadiness({
        accountId: "acc_123",
        artistSlug: "gatsby-grace",
      }),
    ).rejects.toThrow("No GitHub repository configured for this account");
  });
});

