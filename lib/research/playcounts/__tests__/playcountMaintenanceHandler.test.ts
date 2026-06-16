import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { playcountMaintenanceHandler } from "../playcountMaintenanceHandler";
import { validateCronRequest } from "@/lib/internal/validateCronRequest";
import { start } from "workflow/api";
import { startDueMonthlySnapshots } from "../startDueMonthlySnapshots";
import { reclaimStaleSongstatsBackfillRows } from "@/lib/supabase/songstats_backfill_queue/updateSongstatsBackfillQueue";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/internal/validateCronRequest", () => ({ validateCronRequest: vi.fn() }));
vi.mock("workflow/api", () => ({ start: vi.fn() }));
vi.mock("@/app/workflows/songstatsBackfillWorkflow", () => ({
  songstatsBackfillWorkflow: vi.fn(),
}));
vi.mock("../startDueMonthlySnapshots", () => ({ startDueMonthlySnapshots: vi.fn() }));
vi.mock("@/lib/supabase/songstats_backfill_queue/updateSongstatsBackfillQueue", () => ({
  reclaimStaleSongstatsBackfillRows: vi.fn(),
}));

const req = () => new NextRequest("http://x/api/internal/playcount-maintenance");

describe("playcountMaintenanceHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCronRequest).mockReturnValue(null as never);
    vi.mocked(start).mockResolvedValue({ runId: "run_1" } as never);
    vi.mocked(startDueMonthlySnapshots).mockResolvedValue(2 as never);
    vi.mocked(reclaimStaleSongstatsBackfillRows).mockResolvedValue(5);
  });

  it("reclaims stale rows BEFORE starting the drain, and reports the count", async () => {
    const order: string[] = [];
    vi.mocked(reclaimStaleSongstatsBackfillRows).mockImplementation(async () => {
      order.push("reclaim");
      return 5;
    });
    vi.mocked(start).mockImplementation(async () => {
      order.push("drain");
      return { runId: "run_1" } as never;
    });

    const res = await playcountMaintenanceHandler(req());

    expect(order).toEqual(["reclaim", "drain"]);
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({
      status: "success",
      reclaimed: 5,
      backfill_run_id: "run_1",
      monthly_snapshots_started: 2,
    });
  });

  it("denies non-cron requests", async () => {
    vi.mocked(validateCronRequest).mockReturnValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );
    const res = await playcountMaintenanceHandler(req());
    expect(res.status).toBe(401);
    expect(reclaimStaleSongstatsBackfillRows).not.toHaveBeenCalled();
  });
});
