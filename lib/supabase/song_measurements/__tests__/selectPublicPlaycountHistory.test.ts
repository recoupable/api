import { describe, it, expect, vi } from "vitest";
import supabase from "../../serverClient";
import { selectPublicPlaycountHistory } from "../selectPublicPlaycountHistory";
vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));
function mock(result: { data: unknown; count: number | null; error: unknown }) {
  const builder = Object.fromEntries(
    ["select", "eq", "gte", "lt", "order", "limit"].map(name => [name, vi.fn()]),
  ) as Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (value: unknown) => void) => void;
  };
  for (const name of ["select", "eq", "gte", "lt", "order", "limit"]) {
    builder[name].mockReturnValue(builder);
  }
  builder.then = resolve => resolve(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}
const params = { song: "TEST00000001", since: "2026-09-01", until: "2026-09-05" };
describe("selectPublicPlaycountHistory", () => {
  it("filters source, recording, metric and inclusive date boundaries, exposing no raw refs", async () => {
    const builder = mock({
      data: [{ value: 0, captured_at: "2026-09-01T07:00:00Z" }],
      count: 1,
      error: null,
    });
    expect(await selectPublicPlaycountHistory(params)).toHaveLength(1);
    expect(builder.select).toHaveBeenCalledWith("captured_at,value", { count: "exact" });
    expect(builder.eq).toHaveBeenCalledWith("song", params.song);
    expect(builder.eq).toHaveBeenCalledWith("platform", "spotify");
    expect(builder.eq).toHaveBeenCalledWith("metric", "platform_displayed_play_count");
    expect(builder.eq).toHaveBeenCalledWith("data_source", "apify_spotify_playcount");
    expect(builder.gte).toHaveBeenCalledWith("captured_at", "2026-09-01T00:00:00Z");
    expect(builder.lt).toHaveBeenCalledWith("captured_at", "2026-09-06T00:00:00.000Z");
    expect(builder.limit).toHaveBeenCalledWith(500);
  });
  it.each([
    { data: [], count: 501, error: null },
    { data: [], count: 1, error: null },
    { data: null, count: null, error: { message: "unavailable" } },
  ])("fails closed on truncation and database failure: %j", async result => {
    mock(result);
    await expect(selectPublicPlaycountHistory(params)).rejects.toThrow("unavailable");
  });
  it("preserves no observations as an empty series", async () => {
    mock({ data: [], count: 0, error: null });
    expect(await selectPublicPlaycountHistory(params)).toEqual([]);
  });
});
