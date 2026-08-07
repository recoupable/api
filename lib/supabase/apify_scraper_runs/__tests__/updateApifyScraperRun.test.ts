import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/updateApifyScraperRun";

const maybeSingle = vi.fn();
const chain = {
  update: vi.fn(() => chain),
  eq: vi.fn(() => chain),
  is: vi.fn(() => chain),
  select: vi.fn(() => chain),
  maybeSingle,
};
vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn(() => chain) } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateApifyScraperRun", () => {
  it("claims completion only for runs not yet completed — the idempotency guard", async () => {
    maybeSingle.mockResolvedValue({ data: { run_id: "r1", batch_id: "b1" }, error: null });
    const row = await updateApifyScraperRun("r1", ["https://x.com/a/status/1"]);
    expect(chain.eq).toHaveBeenCalledWith("run_id", "r1");
    expect(chain.is).toHaveBeenCalledWith("completed_at", null);
    expect(row).toEqual({ run_id: "r1", batch_id: "b1" });
  });

  it("returns null on a webhook retry (row already completed) so the digest can never re-trigger", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await updateApifyScraperRun("r1", [])).toBeNull();
  });

  it("returns null and logs on error", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await updateApifyScraperRun("r1", [])).toBeNull();
  });
});
