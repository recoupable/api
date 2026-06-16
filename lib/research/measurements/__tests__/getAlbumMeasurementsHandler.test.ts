import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAlbumMeasurementsHandler } from "../getAlbumMeasurementsHandler";
import { validateGetAlbumMeasurementsRequest } from "../validateGetAlbumMeasurementsRequest";
import { getAlbumMeasurements } from "../getAlbumMeasurements";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("../validateGetAlbumMeasurementsRequest", () => ({
  validateGetAlbumMeasurementsRequest: vi.fn(),
}));
vi.mock("../getAlbumMeasurements", () => ({ getAlbumMeasurements: vi.fn() }));

const req = () => new NextRequest("http://x/api/research/albums/AL1/measurements");
const validated = { accountId: "acc_1", spotifyAlbumId: "AL1" } as never;

describe("getAlbumMeasurementsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the album measurements payload on success", async () => {
    vi.mocked(validateGetAlbumMeasurementsRequest).mockResolvedValue(validated);
    vi.mocked(getAlbumMeasurements).mockResolvedValue({
      data: { status: "success", id: "AL1", measurements: [] },
    });
    const res = await getAlbumMeasurementsHandler(req(), "AL1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "AL1" });
  });

  it("short-circuits with the validation response", async () => {
    vi.mocked(validateGetAlbumMeasurementsRequest).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );
    const res = await getAlbumMeasurementsHandler(req(), "AL1");
    expect(res.status).toBe(401);
    expect(getAlbumMeasurements).not.toHaveBeenCalled();
  });

  it("maps error results to error responses", async () => {
    vi.mocked(validateGetAlbumMeasurementsRequest).mockResolvedValue(validated);
    vi.mocked(getAlbumMeasurements).mockResolvedValue({ error: "No snapshot", status: 404 });
    const res = await getAlbumMeasurementsHandler(req(), "AL1");
    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(validateGetAlbumMeasurementsRequest).mockRejectedValue(new Error("boom"));
    const res = await getAlbumMeasurementsHandler(req(), "AL1");
    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });
});
