import { describe, it, expect, vi, beforeEach } from "vitest";

import { resolveTrack } from "../resolveTrack";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getSearch from "@/lib/spotify/getSearch";
import { handleResearch } from "../handleResearch";

vi.mock("@/lib/spotify/generateAccessToken", () => ({ default: vi.fn() }));
vi.mock("@/lib/spotify/getSearch", () => ({ default: vi.fn() }));
vi.mock("../handleResearch", () => ({ handleResearch: vi.fn() }));

describe("resolveTrack", () => {
  const accountId = "acct-1";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateAccessToken).mockResolvedValue({
      access_token: "token",
    } as never);
  });

  it("returns error when Spotify auth fails", async () => {
    vi.mocked(generateAccessToken).mockResolvedValue({ error: "nope" } as never);
    const result = await resolveTrack("q", undefined, accountId);
    expect("error" in result && result.error).toBe("Failed to authenticate with Spotify");
  });

  it("returns error when Spotify search fails", async () => {
    vi.mocked(getSearch).mockResolvedValue({ error: "fail", data: null } as never);
    const result = await resolveTrack("q", undefined, accountId);
    expect("error" in result && result.error).toBe("Spotify search failed");
  });

  it("returns error when no track found", async () => {
    vi.mocked(getSearch).mockResolvedValue({
      data: { tracks: { items: [] } },
    } as never);
    const result = await resolveTrack("q", "Drake", accountId);
    expect("error" in result && result.error).toContain("No track found");
  });

  it("calls handleResearch with ISRC path and accountId when ISRC present", async () => {
    vi.mocked(getSearch).mockResolvedValue({
      data: {
        tracks: {
          items: [{ id: "sp1", name: "T", external_ids: { isrc: "ISRC123" } }],
        },
      },
    } as never);
    vi.mocked(handleResearch).mockResolvedValue({
      data: { chartmetric_ids: [42] },
    });

    const result = await resolveTrack("q", undefined, accountId);
    expect(vi.mocked(handleResearch)).toHaveBeenCalledWith({
      accountId,
      path: "/track/isrc/ISRC123/get-ids",
    });
    expect("id" in result && result.id).toBe("42");
  });

  it("falls back to spotify-id path via handleResearch when ISRC lookup yields no id", async () => {
    vi.mocked(getSearch).mockResolvedValue({
      data: {
        tracks: {
          items: [{ id: "sp1", name: "T", external_ids: { isrc: "ISRC123" } }],
        },
      },
    } as never);
    vi.mocked(handleResearch)
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { chartmetric_ids: [99] } });

    const result = await resolveTrack("q", undefined, accountId);
    expect(vi.mocked(handleResearch)).toHaveBeenNthCalledWith(2, {
      accountId,
      path: "/track/spotify/sp1/get-ids",
    });
    expect("id" in result && result.id).toBe("99");
  });

  it("uses spotify-id path when no ISRC is present", async () => {
    vi.mocked(getSearch).mockResolvedValue({
      data: {
        tracks: { items: [{ id: "sp9", name: "T", external_ids: {} }] },
      },
    } as never);
    vi.mocked(handleResearch).mockResolvedValue({
      data: { chartmetric_ids: [7] },
    });

    const result = await resolveTrack("q", undefined, accountId);
    expect(vi.mocked(handleResearch)).toHaveBeenCalledWith({
      accountId,
      path: "/track/spotify/sp9/get-ids",
    });
    expect("id" in result && result.id).toBe("7");
  });

  it("returns error when neither ISRC nor spotify-id resolves", async () => {
    vi.mocked(getSearch).mockResolvedValue({
      data: {
        tracks: {
          items: [{ id: "sp1", name: "Song", external_ids: { isrc: "X" } }],
        },
      },
    } as never);
    vi.mocked(handleResearch).mockResolvedValue({ data: {} });

    const result = await resolveTrack("q", undefined, accountId);
    expect("error" in result && result.error).toContain("Could not resolve Chartmetric ID");
  });
});
