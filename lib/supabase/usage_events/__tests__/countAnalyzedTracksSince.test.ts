import { describe, it, expect, vi, beforeEach } from "vitest";
import { countAnalyzedTracksSince } from "@/lib/supabase/usage_events/countAnalyzedTracksSince";
import supabase from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn() } }));

function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "not"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q as Record<string, ReturnType<typeof vi.fn>> & { then: unknown };
}

beforeEach(() => vi.clearAllMocks());

describe("countAnalyzedTracksSince", () => {
  it("counts distinct resource_url among the account's Modal rows since the bound", async () => {
    const q = chain({
      data: [
        { resource_url: "https://a/1.mp3" },
        { resource_url: "https://a/1.mp3" },
        { resource_url: "https://a/2.mp3" },
      ],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue(q as never);

    const count = await countAnalyzedTracksSince({
      accountId: "acc",
      since: "2026-09-01T00:00:00.000Z",
    });

    expect(count).toBe(2);
    expect(supabase.from).toHaveBeenCalledWith("usage_events");
    expect(q.select).toHaveBeenCalledWith("resource_url");
    expect(q.eq).toHaveBeenCalledWith("account_id", "acc");
    expect(q.eq).toHaveBeenCalledWith("provider", "modal");
    expect(q.gte).toHaveBeenCalledWith("created_at", "2026-09-01T00:00:00.000Z");
    expect(q.not).toHaveBeenCalledWith("resource_url", "is", null);
  });

  it("returns 0 when there are no rows", async () => {
    vi.mocked(supabase.from).mockReturnValue(chain({ data: [], error: null }) as never);
    expect(await countAnalyzedTracksSince({ accountId: "acc", since: "x" })).toBe(0);
  });

  it("throws on a query error", async () => {
    vi.mocked(supabase.from).mockReturnValue(
      chain({ data: null, error: { message: "boom" } }) as never,
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(countAnalyzedTracksSince({ accountId: "acc", since: "x" })).rejects.toBeTruthy();
    errorSpy.mockRestore();
  });
});
