import { beforeEach, describe, expect, it, vi } from "vitest";
import supabase from "../../serverClient";
import { selectCatalogStreamObservations } from "../selectCatalogStreamObservations";
vi.mock("../../serverClient", () => ({ default: { rpc: vi.fn() } }));
const input = {
  catalogId: "catalog",
  isrc: "USAAA2400001",
  since: "2024-01-01",
  until: "2026-01-02",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
});
describe("saved stream history bounds", () => {
  it.each([1, 62, 63, 124, 125, 732])(
    "dispatches exactly the required windows for %s days",
    async days => {
      const until = new Date(Date.parse(`${input.since}T00:00:00Z`) + days * 86400000)
        .toISOString()
        .slice(0, 10);
      await selectCatalogStreamObservations({ ...input, until });
      expect(supabase.rpc).toHaveBeenCalledTimes(Math.ceil(days / 62));
    },
  );
  it("reads both 366-day comparison periods through nonoverlapping 62-day RPC windows", async () => {
    await selectCatalogStreamObservations(input);
    const calls = vi.mocked(supabase.rpc).mock.calls;
    expect(calls).toHaveLength(12);
    let next = input.since;
    for (const [name, args] of calls) {
      expect(name).toBe("read_catalog_stream_days");
      expect(args).toMatchObject({
        p_catalog_id: input.catalogId,
        p_isrc: input.isrc,
        p_since: next,
      });
      const q = args as { p_since: string; p_until: string };
      expect((Date.parse(q.p_until) - Date.parse(q.p_since)) / 86400000).toBeLessThanOrEqual(62);
      next = q.p_until;
    }
    expect(next).toBe(input.until);
  });
  it("combines rows from each bounded read without losing the boundary date", async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: [{ date: "2024-03-02", streams: 1 }], error: null } as never)
      .mockResolvedValueOnce({ data: [{ date: "2024-03-03", streams: 2 }], error: null } as never);
    expect(await selectCatalogStreamObservations({ ...input, until: "2024-03-04" })).toEqual([
      { date: "2024-03-02", streams: 1 },
      { date: "2024-03-03", streams: 2 },
    ]);
  });
  it("withholds partial results when a later window fails", async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: [{ date: "2024-03-02", streams: 1 }], error: null } as never)
      .mockResolvedValueOnce({ data: null, error: { message: "unavailable" } } as never);
    await expect(
      selectCatalogStreamObservations({ ...input, until: "2024-03-04" }),
    ).rejects.toThrow("Catalog stream history unavailable");
  });
  it.each(["2026-01-03", "2024-01-01", "invalid"])(
    "rejects invalid or excessive spans %s before dispatch",
    async until => {
      await expect(selectCatalogStreamObservations({ ...input, until })).rejects.toThrow(
        "Invalid catalog stream history range",
      );
      expect(supabase.rpc).not.toHaveBeenCalled();
    },
  );
});
