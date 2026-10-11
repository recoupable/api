import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAnalyzedTrackUrlsSince } from "@/lib/supabase/usage_events/selectAnalyzedTrackUrlsSince";
import supabase from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn() } }));

function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "not", "order"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q as Record<string, ReturnType<typeof vi.fn>> & { then: unknown };
}

beforeEach(() => vi.clearAllMocks());

describe("selectAnalyzedTrackUrlsSince", () => {
  it("returns the distinct resource_urls among the account's Modal rows since the bound", async () => {
    const q = chain({
      data: [
        { resource_url: "https://a/1.mp3" },
        { resource_url: "https://a/1.mp3" },
        { resource_url: "https://a/2.mp3" },
      ],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue(q as never);

    const urls = await selectAnalyzedTrackUrlsSince({
      accountId: "acc",
      since: "2026-09-01T00:00:00.000Z",
    });

    expect(urls).toEqual(["https://a/1.mp3", "https://a/2.mp3"]);
    expect(supabase.from).toHaveBeenCalledWith("usage_events");
    expect(q.select).toHaveBeenCalledWith("resource_url");
    expect(q.eq).toHaveBeenCalledWith("account_id", "acc");
    expect(q.eq).toHaveBeenCalledWith("provider", "modal");
    expect(q.gte).toHaveBeenCalledWith("created_at", "2026-09-01T00:00:00.000Z");
    expect(q.not).toHaveBeenCalledWith("resource_url", "is", null);
    expect(q.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: true });
    expect(q.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });

  it("returns an empty list when there are no rows", async () => {
    vi.mocked(supabase.from).mockReturnValue(chain({ data: [], error: null }) as never);
    expect(await selectAnalyzedTrackUrlsSince({ accountId: "acc", since: "x" })).toEqual([]);
  });

  it("throws on a query error", async () => {
    vi.mocked(supabase.from).mockReturnValue(
      chain({ data: null, error: { message: "boom" } }) as never,
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      selectAnalyzedTrackUrlsSince({ accountId: "acc", since: "x" }),
    ).rejects.toBeTruthy();
    errorSpy.mockRestore();
  });
});
