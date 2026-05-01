import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchChartmetric } from "@/lib/chartmetric/fetchChartmetric";

vi.mock("@/lib/chartmetric/getChartmetricToken", () => ({
  getChartmetricToken: vi.fn().mockResolvedValue("mock-token"),
}));

const mockFetch = vi.fn();

describe("fetchChartmetric", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("strips the obj wrapper from Chartmetric responses", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ obj: { name: "Drake", id: 3380 } }),
    } as Response);

    const result = await fetchChartmetric("/artist/3380");

    expect(result.data).toEqual({ name: "Drake", id: 3380 });
    expect(result.status).toBe(200);
  });

  it("passes through responses without obj wrapper", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ name: "Drake" }] }),
    } as Response);

    const result = await fetchChartmetric("/search", { q: "Drake" });

    expect(result.data).toEqual({ results: [{ name: "Drake" }] });
  });

  it("appends query params to the URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ obj: [] }),
    } as Response);

    await fetchChartmetric("/search", { q: "Drake", type: "artists" });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("q=Drake");
    expect(calledUrl).toContain("type=artists");
  });

  it("sends Authorization header with token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ obj: {} }),
    } as Response);

    await fetchChartmetric("/artist/3380");

    const calledOpts = mockFetch.mock.calls[0][1];
    expect(calledOpts.headers).toMatchObject({ Authorization: "Bearer mock-token" });
  });

  it("returns error data on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const result = await fetchChartmetric("/artist/99999");

    expect(result.status).toBe(404);
    expect(result.data).toEqual({ error: "Chartmetric API returned 404" });
  });

  it("skips empty query param values", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ obj: [] }),
    } as Response);

    await fetchChartmetric("/search", { q: "Drake", type: "" });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("q=Drake");
    expect(calledUrl).not.toContain("type=");
  });
});
