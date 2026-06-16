import { describe, it, expect, vi, beforeEach } from "vitest";
import { songstatsBackfillWorkflow } from "../songstatsBackfillWorkflow";

import { getBackfillBudgetStep } from "../getBackfillBudgetStep";
import { claimBackfillRowsStep } from "../claimBackfillRowsStep";
import { backfillTrackStep } from "../backfillTrackStep";
import { releaseClaimedRowsStep } from "../releaseClaimedRowsStep";

vi.mock("../getBackfillBudgetStep", () => ({ getBackfillBudgetStep: vi.fn() }));
vi.mock("../claimBackfillRowsStep", () => ({ claimBackfillRowsStep: vi.fn() }));
vi.mock("../backfillTrackStep", () => ({ backfillTrackStep: vi.fn() }));
vi.mock("../releaseClaimedRowsStep", () => ({ releaseClaimedRowsStep: vi.fn() }));

const row = (id: string) => ({ id, song: id }) as never;

describe("songstatsBackfillWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(releaseClaimedRowsStep).mockResolvedValue(undefined);
  });

  it("releases the rest of the claimed batch to pending when a track defers", async () => {
    vi.mocked(getBackfillBudgetStep).mockResolvedValue(100);
    vi.mocked(claimBackfillRowsStep).mockResolvedValue([row("r1"), row("r2"), row("r3")]);
    vi.mocked(backfillTrackStep)
      .mockResolvedValueOnce({ ok: true, hitsSpent: 1 }) // r1
      .mockResolvedValueOnce({ ok: false, hitsSpent: 0, deferred: true }); // r2 defers

    const result = await songstatsBackfillWorkflow();

    // r2 is set pending by the step itself; the unprocessed remainder (r3) is released here
    expect(releaseClaimedRowsStep).toHaveBeenCalledWith(["r3"]);
    expect(backfillTrackStep).toHaveBeenCalledTimes(2); // stopped at the defer, never reached r3
    expect(result).toEqual({ backfilled: 1, failed: 0, deferred: true });
  });

  it("drains until the queue is empty and never releases when nothing defers", async () => {
    vi.mocked(getBackfillBudgetStep).mockResolvedValue(100);
    vi.mocked(claimBackfillRowsStep)
      .mockResolvedValueOnce([row("a"), row("b")])
      .mockResolvedValueOnce([]); // queue drained
    vi.mocked(backfillTrackStep)
      .mockResolvedValueOnce({ ok: true, hitsSpent: 1 })
      .mockResolvedValueOnce({ ok: false, hitsSpent: 1 }); // terminal (e.g. 404)

    const result = await songstatsBackfillWorkflow();

    expect(releaseClaimedRowsStep).not.toHaveBeenCalled();
    expect(result).toEqual({ backfilled: 1, failed: 1, deferred: false });
  });

  it("does not drain when there is no budget", async () => {
    vi.mocked(getBackfillBudgetStep).mockResolvedValue(0);

    const result = await songstatsBackfillWorkflow();

    expect(claimBackfillRowsStep).not.toHaveBeenCalled();
    expect(result).toEqual({ backfilled: 0, failed: 0, deferred: false });
  });
});
