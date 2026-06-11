import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetPlaycountDeltasRequest } from "../validateGetPlaycountDeltasRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/research/ensureResearchCredits", () => ({ ensureResearchCredits: vi.fn() }));

const req = (qs: string) => new NextRequest(`http://x/api/research/track/playcount-deltas${qs}`);

describe("validateGetPlaycountDeltasRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
    vi.mocked(ensureResearchCredits).mockResolvedValue(null as never);
  });

  it("returns validated params for a complete request", async () => {
    const result = await validateGetPlaycountDeltasRequest(
      req("?isrc=USA2P2015959&since=2026-06-09&until=2026-07-09"),
    );

    expect(result).toEqual({
      accountId: "acc_1",
      isrc: "USA2P2015959",
      since: "2026-06-09",
      until: "2026-07-09",
    });
  });

  it("omits until when absent", async () => {
    const result = await validateGetPlaycountDeltasRequest(req("?isrc=X&since=2026-06-09"));

    expect(result).toEqual({ accountId: "acc_1", isrc: "X", since: "2026-06-09" });
  });

  it("returns 400 when isrc or since is missing, or since is not a date", async () => {
    for (const qs of ["?since=2026-06-09", "?isrc=X", "?isrc=X&since=junk"]) {
      const result = await validateGetPlaycountDeltasRequest(req(qs));
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    }
  });

  it("short-circuits with auth and credits responses", async () => {
    const denied = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(denied as never);
    expect(await validateGetPlaycountDeltasRequest(req("?isrc=X&since=2026-06-09"))).toBe(denied);
  });
});
