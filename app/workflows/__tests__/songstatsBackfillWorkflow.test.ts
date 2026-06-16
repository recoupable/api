import { describe, it, expect, vi, beforeEach } from "vitest";
import { songstatsBackfillWorkflow } from "../songstatsBackfillWorkflow";

import { claimBackfillRowsStep } from "../claimBackfillRowsStep";
import { backfillTrackStep } from "../backfillTrackStep";
import { releaseClaimedRowsStep } from "../releaseClaimedRowsStep";

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
    vi.mocked(claimBackfillRowsStep).mockResolvedValue([row("r1"), row("r2"), row("r3")]);
    vi.mocked(backfillTrackStep)
      .mockResolvedValueOnce({ ok: true }) // r1
      .mockResolvedValueOnce({ ok: false, deferred: true }); // r2 defers

    const result = await songstatsBackfillWorkflow();

    // r2 is set pending by the step itself; the unprocessed remainder (r3) is released here
    expect(releaseClaimedRowsStep).toHaveBeenCalledWith(["r3"]);
    expect(backfillTrackStep).toHaveBeenCalledTimes(2); // stopped at the defer, never reached r3
    expect(result).toEqual({ backfilled: 1, terminal: 0, deferred: true });
  });

  it("drains until the queue is empty and never releases when nothing defers", async () => {
    vi.mocked(claimBackfillRowsStep)
      .mockResolvedValueOnce([row("a"), row("b")])
      .mockResolvedValueOnce([]); // queue drained
    vi.mocked(backfillTrackStep)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false }); // terminal (e.g. 404)

    const result = await songstatsBackfillWorkflow();

    expect(releaseClaimedRowsStep).not.toHaveBeenCalled();
    expect(result).toEqual({ backfilled: 1, terminal: 1, deferred: false });
  });

  it("stops immediately when the first claim is empty", async () => {
    vi.mocked(claimBackfillRowsStep).mockResolvedValue([]);

    const result = await songstatsBackfillWorkflow();

    expect(backfillTrackStep).not.toHaveBeenCalled();
    expect(result).toEqual({ backfilled: 0, terminal: 0, deferred: false });
  });
});
