import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetTrackMeasurementsRequest } from "../validateGetTrackMeasurementsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const req = (qs = "") =>
  new NextRequest(`http://x/api/research/tracks/USQY51771120/measurements${qs}`);

describe("validateGetTrackMeasurementsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
  });

  it("returns the auth response (401) when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );
    const r = await validateGetTrackMeasurementsRequest(req(), "USQY51771120");
    expect((r as NextResponse).status).toBe(401);
  });

  it("400s when aggregate is not run_rate", async () => {
    const r = await validateGetTrackMeasurementsRequest(req("?aggregate=avg"), "USQY51771120");
    expect((r as NextResponse).status).toBe(400);
  });

  it("defaults platform, metric, window; no aggregate", async () => {
    const r = await validateGetTrackMeasurementsRequest(req(), "USQY51771120");
    expect(r).toEqual({
      accountId: "acc_1",
      id: "USQY51771120",
      platform: "spotify",
      metric: "platform_displayed_play_count",
      aggregate: undefined,
      windowDays: 365,
    });
  });

  it("parses aggregate=run_rate and window=90d", async () => {
    const r = await validateGetTrackMeasurementsRequest(
      req("?aggregate=run_rate&window=90d"),
      "USQY51771120",
    );
    expect(r).toMatchObject({ aggregate: "run_rate", windowDays: 90 });
  });
});
