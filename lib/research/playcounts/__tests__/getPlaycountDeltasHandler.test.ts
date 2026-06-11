import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getPlaycountDeltasHandler } from "../getPlaycountDeltasHandler";
import { validateGetPlaycountDeltasRequest } from "../validateGetPlaycountDeltasRequest";
import { getPlaycountDeltas } from "../getPlaycountDeltas";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("../validateGetPlaycountDeltasRequest", () => ({
  validateGetPlaycountDeltasRequest: vi.fn(),
}));
vi.mock("../getPlaycountDeltas", () => ({ getPlaycountDeltas: vi.fn() }));

const req = () => new NextRequest("http://x/api/research/track/playcount-deltas?isrc=X&since=Y");

describe("getPlaycountDeltasHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the deltas payload on success", async () => {
    vi.mocked(validateGetPlaycountDeltasRequest).mockResolvedValue({
      accountId: "acc_1",
      isrc: "X",
      since: "2026-06-09",
    });
    vi.mocked(getPlaycountDeltas).mockResolvedValue({
      data: { status: "success", isrc: "X", deltas: [] },
    });

    const res = await getPlaycountDeltasHandler(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", isrc: "X", deltas: [] });
  });

  it("short-circuits with the validation response", async () => {
    vi.mocked(validateGetPlaycountDeltasRequest).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 400 }),
    );

    const res = await getPlaycountDeltasHandler(req());

    expect(res.status).toBe(400);
    expect(getPlaycountDeltas).not.toHaveBeenCalled();
  });

  it("maps error results to error responses", async () => {
    vi.mocked(validateGetPlaycountDeltasRequest).mockResolvedValue({
      accountId: "acc_1",
      isrc: "X",
      since: "2026-06-09",
    });
    vi.mocked(getPlaycountDeltas).mockResolvedValue({ error: "Unknown ISRC", status: 404 });

    const res = await getPlaycountDeltasHandler(req());

    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(validateGetPlaycountDeltasRequest).mockRejectedValue(new Error("boom"));

    const res = await getPlaycountDeltasHandler(req());

    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });
});
