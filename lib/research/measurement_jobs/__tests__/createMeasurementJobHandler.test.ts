import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createMeasurementJobHandler } from "../createMeasurementJobHandler";
import { validateCreateMeasurementJobRequest } from "../validateCreateMeasurementJobRequest";
import { createMeasurementJob } from "../createMeasurementJob";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("../validateCreateMeasurementJobRequest", () => ({
  validateCreateMeasurementJobRequest: vi.fn(),
}));
vi.mock("../createMeasurementJob", () => ({ createMeasurementJob: vi.fn() }));

const req = () => new NextRequest("http://x/api/research/measurement-jobs", { method: "POST" });
const validated = {
  accountId: "acc_1",
  body: { scope: { isrcs: ["X"] }, source: "historical", platforms: ["spotify"] },
} as never;

describe("createMeasurementJobHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the job payload with 202 on success", async () => {
    vi.mocked(validateCreateMeasurementJobRequest).mockResolvedValue(validated);
    vi.mocked(createMeasurementJob).mockResolvedValue({
      data: { status: "success", source: "historical", id: null, enqueued: 5, skipped: 0 },
    });
    const res = await createMeasurementJobHandler(req());
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ enqueued: 5, source: "historical" });
  });

  it("short-circuits with the validation response", async () => {
    vi.mocked(validateCreateMeasurementJobRequest).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 400 }) as never,
    );
    const res = await createMeasurementJobHandler(req());
    expect(res.status).toBe(400);
    expect(createMeasurementJob).not.toHaveBeenCalled();
  });

  it("maps error results to error responses", async () => {
    vi.mocked(validateCreateMeasurementJobRequest).mockResolvedValue(validated);
    vi.mocked(createMeasurementJob).mockResolvedValue({ error: "cap reached", status: 429 });
    const res = await createMeasurementJobHandler(req());
    expect(res.status).toBe(429);
  });

  it("returns 500 on unexpected errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(validateCreateMeasurementJobRequest).mockRejectedValue(new Error("boom"));
    const res = await createMeasurementJobHandler(req());
    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });
});
