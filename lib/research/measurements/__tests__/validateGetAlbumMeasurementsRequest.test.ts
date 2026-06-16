import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetAlbumMeasurementsRequest } from "../validateGetAlbumMeasurementsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const req = () => new NextRequest("http://x/api/research/albums/AL1/measurements");

describe("validateGetAlbumMeasurementsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
  });

  it("returns the auth response (401) when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );
    const r = await validateGetAlbumMeasurementsRequest(req(), "AL1");
    expect((r as NextResponse).status).toBe(401);
  });

  it("returns account + album id on success", async () => {
    const r = await validateGetAlbumMeasurementsRequest(req(), "AL1");
    expect(r).toEqual({ accountId: "acc_1", spotifyAlbumId: "AL1" });
  });
});
