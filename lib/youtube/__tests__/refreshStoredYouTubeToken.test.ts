import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshStoredYouTubeToken } from "@/lib/youtube/refreshStoredYouTubeToken";
import { createYouTubeOAuthClient } from "@/lib/youtube/oauth-client";
import { upsertYouTubeTokens } from "@/lib/supabase/youtube_tokens/upsertYouTubeTokens";

vi.mock("@/lib/youtube/oauth-client", () => ({
  createYouTubeOAuthClient: vi.fn(),
}));
vi.mock("@/lib/supabase/youtube_tokens/upsertYouTubeTokens", () => ({
  upsertYouTubeTokens: vi.fn(),
}));

const ARTIST_ID = "11111111-1111-1111-1111-111111111111";

const baseStoredTokens = {
  id: "row-1",
  artist_account_id: ARTIST_ID,
  access_token: "access-old",
  refresh_token: "refresh-abc",
  expires_at: new Date(Date.now() - 1_000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockOAuthClient = (refreshResult: Promise<{ credentials: Record<string, unknown> }>) => {
  const setCredentials = vi.fn();
  const refreshAccessToken = vi.fn(() => refreshResult);
  vi.mocked(createYouTubeOAuthClient).mockReturnValue({
    setCredentials,
    refreshAccessToken,
  } as unknown as ReturnType<typeof createYouTubeOAuthClient>);
  return { setCredentials, refreshAccessToken };
};

describe("refreshStoredYouTubeToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("returns the refreshed tokens row on success", async () => {
    const newExpiry = Date.now() + 3_600_000;
    mockOAuthClient(
      Promise.resolve({
        credentials: { access_token: "access-new", expiry_date: newExpiry },
      }),
    );
    const updatedRow = {
      ...baseStoredTokens,
      access_token: "access-new",
      expires_at: new Date(newExpiry).toISOString(),
    };
    vi.mocked(upsertYouTubeTokens).mockResolvedValue(updatedRow);

    const result = await refreshStoredYouTubeToken(baseStoredTokens, ARTIST_ID);

    expect(result).toEqual(updatedRow);
    expect(upsertYouTubeTokens).toHaveBeenCalledWith({
      ...baseStoredTokens,
      access_token: "access-new",
      expires_at: new Date(newExpiry).toISOString(),
    });
  });

  it("throws when the stored tokens have no refresh_token", async () => {
    await expect(
      refreshStoredYouTubeToken({ ...baseStoredTokens, refresh_token: null }, ARTIST_ID),
    ).rejects.toThrow(/No refresh token available/);
  });

  it("throws when Google's refresh response is missing access_token", async () => {
    mockOAuthClient(
      Promise.resolve({
        credentials: { expiry_date: Date.now() + 3_600_000 },
      }),
    );

    await expect(refreshStoredYouTubeToken(baseStoredTokens, ARTIST_ID)).rejects.toThrow(
      /missing access_token or expiry_date/,
    );
  });

  it("throws when Google's refresh response is missing expiry_date", async () => {
    mockOAuthClient(Promise.resolve({ credentials: { access_token: "access-new" } }));

    await expect(refreshStoredYouTubeToken(baseStoredTokens, ARTIST_ID)).rejects.toThrow(
      /missing access_token or expiry_date/,
    );
  });

  it("re-throws Google refresh failures and logs them", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const googleError = new Error("invalid_grant");
    mockOAuthClient(Promise.reject(googleError));

    await expect(refreshStoredYouTubeToken(baseStoredTokens, ARTIST_ID)).rejects.toBe(googleError);

    expect(errorSpy).toHaveBeenCalledWith(
      `Error refreshing YouTube token for account ${ARTIST_ID}:`,
      googleError,
    );
  });

  it("throws when upsertYouTubeTokens returns a falsy value", async () => {
    mockOAuthClient(
      Promise.resolve({
        credentials: {
          access_token: "access-new",
          expiry_date: Date.now() + 3_600_000,
        },
      }),
    );
    vi.mocked(upsertYouTubeTokens).mockResolvedValue(null);

    await expect(refreshStoredYouTubeToken(baseStoredTokens, ARTIST_ID)).rejects.toThrow(
      /Failed to update refreshed tokens in DB/,
    );
  });
});
