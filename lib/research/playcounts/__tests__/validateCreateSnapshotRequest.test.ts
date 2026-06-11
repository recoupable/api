import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateSnapshotRequest } from "../validateCreateSnapshotRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const req = (body: unknown) =>
  new NextRequest("http://x/api/research/snapshots", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("validateCreateSnapshotRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
  });

  it("accepts album_ids with defaults applied", async () => {
    const result = await validateCreateSnapshotRequest(req({ album_ids: ["a1"] }));

    expect(result).toEqual({
      accountId: "acc_1",
      body: { album_ids: ["a1"], platforms: ["spotify"], schedule: "once" },
    });
  });

  it("rejects more or less than exactly one input kind", async () => {
    for (const body of [{}, { album_ids: ["a"], isrcs: ["i"] }]) {
      const result = await validateCreateSnapshotRequest(req(body));
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    }
  });

  it("rejects unknown platforms and schedules", async () => {
    for (const body of [
      { album_ids: ["a"], platforms: ["apple_music"] },
      { album_ids: ["a"], schedule: "weekly" },
    ]) {
      const result = await validateCreateSnapshotRequest(req(body));
      expect((result as NextResponse).status).toBe(400);
    }
  });

  it("short-circuits with the auth response", async () => {
    const denied = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(denied as never);

    expect(await validateCreateSnapshotRequest(req({ album_ids: ["a"] }))).toBe(denied);
  });
});
