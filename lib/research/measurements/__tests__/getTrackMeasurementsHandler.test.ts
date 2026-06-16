import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getTrackMeasurementsHandler } from "../getTrackMeasurementsHandler";
import { validateGetTrackMeasurementsRequest } from "../validateGetTrackMeasurementsRequest";
import { getTrackMeasurements } from "../getTrackMeasurements";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("../validateGetTrackMeasurementsRequest", () => ({
  validateGetTrackMeasurementsRequest: vi.fn(),
}));
vi.mock("../getTrackMeasurements", () => ({ getTrackMeasurements: vi.fn() }));

const req = () => new NextRequest("http://x/api/research/tracks/I/measurements");
const validated = {
  accountId: "acc_1",
  id: "I",
  platform: "spotify",
  metric: "platform_displayed_play_count",
  windowDays: 365,
} as never;

describe("getTrackMeasurementsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the measurements payload on success", async () => {
    vi.mocked(validateGetTrackMeasurementsRequest).mockResolvedValue(validated);
    vi.mocked(getTrackMeasurements).mockResolvedValue({
      data: { status: "success", id: "I", series: [] },
    });
    const res = await getTrackMeasurementsHandler(req(), "I");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "success", id: "I" });
  });

  it("short-circuits with the validation response", async () => {
    vi.mocked(validateGetTrackMeasurementsRequest).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );
    const res = await getTrackMeasurementsHandler(req(), "I");
    expect(res.status).toBe(401);
    expect(getTrackMeasurements).not.toHaveBeenCalled();
  });

  it("maps error results to error responses", async () => {
    vi.mocked(validateGetTrackMeasurementsRequest).mockResolvedValue(validated);
    vi.mocked(getTrackMeasurements).mockResolvedValue({ error: "Unknown track id", status: 404 });
    const res = await getTrackMeasurementsHandler(req(), "I");
    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(validateGetTrackMeasurementsRequest).mockRejectedValue(new Error("boom"));
    const res = await getTrackMeasurementsHandler(req(), "I");
    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });
});
