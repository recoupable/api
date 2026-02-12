import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAccountArtistId } from "../selectAccountArtistId";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

import supabase from "../../serverClient";

describe("selectAccountArtistId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the row when account has direct access to artist", async () => {
    const row = { artist_id: "artist-123" };
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      }),
    } as never);

    const result = await selectAccountArtistId("account-123", "artist-123");

    expect(supabase.from).toHaveBeenCalledWith("account_artist_ids");
    expect(result).toEqual(row);
  });

  it("should return null when no direct access exists", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as never);

    const result = await selectAccountArtistId("account-123", "artist-123");

    expect(result).toBeNull();
  });

  it("should return null on database error", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("DB error"),
            }),
          }),
        }),
      }),
    } as never);

    const result = await selectAccountArtistId("account-123", "artist-123");

    expect(result).toBeNull();
  });
});
