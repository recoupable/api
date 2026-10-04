import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));

vi.mock("@/lib/supabase/artist_fan_segment/selectArtistFanSegments", () => ({
  selectArtistFanSegments: vi.fn(),
}));

import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { selectArtistFanSegments } from "@/lib/supabase/artist_fan_segment/selectArtistFanSegments";
import { getFanSegmentsHandler } from "../getFanSegmentsHandler";

describe("getFanSegmentsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when artistId is missing", async () => {
    const result = await getFanSegmentsHandler({ artistId: "" });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when account_socials lookup fails", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue(null);

    const result = await getFanSegmentsHandler({ artistId: "art-1" });

    expect(selectAccountSocials).toHaveBeenCalledWith("art-1");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns fan_segments on success", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue([
      { social: { id: "s1" } } as any,
      { social: { id: "s2" } } as any,
    ]);
    vi.mocked(selectArtistFanSegments).mockResolvedValue([
      { id: "fs-1", artist_social_id: "s1" } as any,
    ]);

    const result = await getFanSegmentsHandler({ artistId: "art-1" });

    expect(selectArtistFanSegments).toHaveBeenCalledWith(["s1", "s2"]);
    expect(result).toBeInstanceOf(NextResponse);
    const json = await (result as NextResponse).json();
    expect(json.fan_segments).toEqual([{ id: "fs-1", artist_social_id: "s1" }]);
    expect((result as NextResponse).status).toBe(200);
  });

  it("returns empty fan_segments when no socials found", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue([]);
    vi.mocked(selectArtistFanSegments).mockResolvedValue([]);

    const result = await getFanSegmentsHandler({ artistId: "art-1" });

    expect(selectArtistFanSegments).toHaveBeenCalledWith([]);
    expect(result).toBeInstanceOf(NextResponse);
    const json = await (result as NextResponse).json();
    expect(json.fan_segments).toEqual([]);
  });

  it("returns 400 on unexpected error", async () => {
    vi.mocked(selectAccountSocials).mockRejectedValue(new Error("db error"));

    const result = await getFanSegmentsHandler({ artistId: "art-1" });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
