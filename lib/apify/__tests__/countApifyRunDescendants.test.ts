import { describe, it, expect, vi, beforeEach } from "vitest";
import { countApifyRunDescendants } from "../countApifyRunDescendants";
import { selectApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRun";

vi.mock("@/lib/supabase/apify_scraper_runs/selectApifyScraperRun", () => ({
  selectApifyScraperRun: vi.fn(),
}));

const rows = (ids: string[]) => ids.map(run_id => ({ run_id })) as never;

beforeEach(() => vi.clearAllMocks());

describe("countApifyRunDescendants", () => {
  it("sums every generation under the root: 1 comments run + 1 fan batch = 2", async () => {
    vi.mocked(selectApifyScraperRun)
      .mockResolvedValueOnce(rows(["comments"]))
      .mockResolvedValueOnce(rows(["fans"]))
      .mockResolvedValueOnce(rows([]));
    expect(await countApifyRunDescendants("root", 50)).toBe(2);
    expect(selectApifyScraperRun).toHaveBeenNthCalledWith(1, { parentRunIds: ["root"] });
    expect(selectApifyScraperRun).toHaveBeenNthCalledWith(2, { parentRunIds: ["comments"] });
    expect(selectApifyScraperRun).toHaveBeenNthCalledWith(3, { parentRunIds: ["fans"] });
  });

  it("stops at a bounded depth so a pathological chain cannot recurse forever", async () => {
    vi.mocked(selectApifyScraperRun).mockResolvedValue(rows(["x"]));
    expect(await countApifyRunDescendants("root", 50)).toBe(5);
    expect(vi.mocked(selectApifyScraperRun).mock.calls).toHaveLength(5);
  });

  it("returns 0 for a root with no children", async () => {
    vi.mocked(selectApifyScraperRun).mockResolvedValue(rows([]));
    expect(await countApifyRunDescendants("root", 50)).toBe(0);
  });

  it("stops walking once the cap is reached and never queries past it", async () => {
    const wide = Array.from({ length: 80 }, (_, i) => `run-${i}`);
    vi.mocked(selectApifyScraperRun).mockResolvedValue(rows(wide));
    expect(await countApifyRunDescendants("root", 50)).toBe(50);
    expect(selectApifyScraperRun).toHaveBeenCalledTimes(1);
  });
});
