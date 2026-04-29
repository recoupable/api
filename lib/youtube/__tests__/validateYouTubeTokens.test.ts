import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateYouTubeTokens } from "@/lib/youtube/validateYouTubeTokens";
import { selectYouTubeTokens } from "@/lib/supabase/youtube_tokens/selectYouTubeTokens";
import { isTokenExpired } from "@/lib/youtube/isTokenExpired";
import { refreshStoredYouTubeToken } from "@/lib/youtube/refreshStoredYouTubeToken";

vi.mock("@/lib/supabase/youtube_tokens/selectYouTubeTokens", () => ({
  selectYouTubeTokens: vi.fn(),
}));
vi.mock("@/lib/youtube/isTokenExpired", () => ({
  isTokenExpired: vi.fn(),
}));
vi.mock("@/lib/youtube/refreshStoredYouTubeToken", () => ({
  refreshStoredYouTubeToken: vi.fn(),
}));

const ARTIST_ID = "11111111-1111-1111-1111-111111111111";

const validTokens = {
  id: "row-1",
  artist_account_id: ARTIST_ID,
  access_token: "access-abc",
  refresh_token: "refresh-abc",
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("validateYouTubeTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when no tokens row exists for the artist", async () => {
    vi.mocked(selectYouTubeTokens).mockResolvedValue(null);

    await expect(validateYouTubeTokens(ARTIST_ID)).rejects.toThrow("youtube tokens not found");
    expect(isTokenExpired).not.toHaveBeenCalled();
    expect(refreshStoredYouTubeToken).not.toHaveBeenCalled();
  });

  it("returns the stored tokens when not expired", async () => {
    vi.mocked(selectYouTubeTokens).mockResolvedValue(validTokens);
    vi.mocked(isTokenExpired).mockReturnValue(false);

    const result = await validateYouTubeTokens(ARTIST_ID);

    expect(result).toEqual(validTokens);
    expect(refreshStoredYouTubeToken).not.toHaveBeenCalled();
  });

  it("returns the refreshed tokens when expired and refresh succeeds", async () => {
    const refreshed = { ...validTokens, access_token: "refreshed-abc" };
    vi.mocked(selectYouTubeTokens).mockResolvedValue(validTokens);
    vi.mocked(isTokenExpired).mockReturnValue(true);
    vi.mocked(refreshStoredYouTubeToken).mockResolvedValue(refreshed);

    const result = await validateYouTubeTokens(ARTIST_ID);

    expect(result).toEqual(refreshed);
    expect(refreshStoredYouTubeToken).toHaveBeenCalledWith(validTokens, ARTIST_ID);
  });

  it("throws when expired and there is no refresh_token (user must re-auth)", async () => {
    vi.mocked(selectYouTubeTokens).mockResolvedValue({
      ...validTokens,
      refresh_token: null,
    });
    vi.mocked(isTokenExpired).mockReturnValue(true);

    await expect(validateYouTubeTokens(ARTIST_ID)).rejects.toThrow(
      "youtube tokens expired with no refresh_token",
    );
    expect(refreshStoredYouTubeToken).not.toHaveBeenCalled();
  });

  it("propagates errors from selectYouTubeTokens (no swallowing)", async () => {
    const dbError = new Error("db down");
    vi.mocked(selectYouTubeTokens).mockRejectedValue(dbError);

    await expect(validateYouTubeTokens(ARTIST_ID)).rejects.toBe(dbError);
  });

  it("propagates errors from refreshStoredYouTubeToken (no swallowing)", async () => {
    const refreshError = new Error("invalid_grant");
    vi.mocked(selectYouTubeTokens).mockResolvedValue(validTokens);
    vi.mocked(isTokenExpired).mockReturnValue(true);
    vi.mocked(refreshStoredYouTubeToken).mockRejectedValue(refreshError);

    await expect(validateYouTubeTokens(ARTIST_ID)).rejects.toBe(refreshError);
  });
});
