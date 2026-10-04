import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/supabase/account_artist_ids/toggleArtistPin", () => ({
  toggleArtistPin: vi.fn(),
}));

import { toggleArtistPin } from "@/lib/supabase/account_artist_ids/toggleArtistPin";
import { toggleArtistPinHandler } from "../toggleArtistPinHandler";

describe("toggleArtistPinHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when accountId is missing", async () => {
    const result = await toggleArtistPinHandler({
      accountId: "",
      artistId: "art-1",
      pinned: true,
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when artistId is missing", async () => {
    const result = await toggleArtistPinHandler({
      accountId: "acc-1",
      artistId: "",
      pinned: true,
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when pinned is not a boolean", async () => {
    const result = await toggleArtistPinHandler({
      accountId: "acc-1",
      artistId: "art-1",
      pinned: "yes" as any,
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns success when pin toggled", async () => {
    vi.mocked(toggleArtistPin).mockResolvedValue({ success: true, pinned: true });

    const result = await toggleArtistPinHandler({
      accountId: "acc-1",
      artistId: "art-1",
      pinned: true,
    });

    expect(toggleArtistPin).toHaveBeenCalledWith({
      accountId: "acc-1",
      artistId: "art-1",
      pinned: true,
    });
    expect(result).toBeInstanceOf(NextResponse);
    const json = await (result as NextResponse).json();
    expect(json).toEqual({ success: true, pinned: true });
    expect((result as NextResponse).status).toBe(200);
  });

  it("returns 400 on error", async () => {
    vi.mocked(toggleArtistPin).mockRejectedValue(new Error("Failed to update pinned status"));

    const result = await toggleArtistPinHandler({
      accountId: "acc-1",
      artistId: "art-1",
      pinned: false,
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const json = await (result as NextResponse).json();
    expect(json.message).toBe("Failed to update pinned status");
  });
});
