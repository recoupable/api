import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { playcountMaintenanceHandler } from "../playcountMaintenanceHandler";
import { validateCronRequest } from "@/lib/internal/validateCronRequest";
import { startDueMonthlySnapshots } from "../startDueMonthlySnapshots";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/internal/validateCronRequest", () => ({ validateCronRequest: vi.fn() }));
vi.mock("../startDueMonthlySnapshots", () => ({ startDueMonthlySnapshots: vi.fn() }));

const req = () => new NextRequest("http://x/api/internal/playcount-maintenance");

describe("playcountMaintenanceHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCronRequest).mockReturnValue(null as never);
    vi.mocked(startDueMonthlySnapshots).mockResolvedValue(2 as never);
  });

  it("starts the due monthly snapshots and reports the count", async () => {
    const res = await playcountMaintenanceHandler(req());
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "success", monthly_snapshots_started: 2 });
  });

  it("denies non-cron requests", async () => {
    vi.mocked(validateCronRequest).mockReturnValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );
    const res = await playcountMaintenanceHandler(req());
    expect(res.status).toBe(401);
    expect(startDueMonthlySnapshots).not.toHaveBeenCalled();
  });
});
