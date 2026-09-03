import { describe, it, expect, vi, afterEach } from "vitest";
import { getFalBillableUnits } from "@/lib/fal/getFalBillableUnits";

const mockFetch = (headers: Record<string, string>, ok = true) =>
  vi.fn().mockResolvedValue({
    ok,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  });

afterEach(() => vi.restoreAllMocks());

describe("getFalBillableUnits", () => {
  it("reads the exact billed quantity from x-fal-billable-units", async () => {
    vi.stubGlobal("fetch", mockFetch({ "x-fal-billable-units": "8" }));
    expect(await getFalBillableUnits("minimax/h3-max/image-to-video", "req-1")).toBe(8);
  });

  it("parses a fractional value", async () => {
    vi.stubGlobal("fetch", mockFetch({ "x-fal-billable-units": "8.0" }));
    expect(await getFalBillableUnits("minimax/h3-max/image-to-video", "req-1")).toBe(8);
  });

  it("hits the queue app base — owner/alias only, not the full endpoint path", async () => {
    const fetchMock = mockFetch({ "x-fal-billable-units": "1" });
    vi.stubGlobal("fetch", fetchMock);
    await getFalBillableUnits("meta/muse-image/text-to-image", "req-2");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://queue.fal.run/meta/muse-image/requests/req-2",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expect.stringContaining("Key ") }),
      }),
    );
  });

  it("returns null when the header is missing", async () => {
    vi.stubGlobal("fetch", mockFetch({}));
    expect(await getFalBillableUnits("meta/muse-image/text-to-image", "req-3")).toBeNull();
  });

  it("returns null on a non-ok response rather than throwing", async () => {
    vi.stubGlobal("fetch", mockFetch({}, false));
    expect(await getFalBillableUnits("meta/muse-image/text-to-image", "req-4")).toBeNull();
  });

  it("returns null when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await getFalBillableUnits("meta/muse-image/text-to-image", "req-5")).toBeNull();
  });

  it("bounds the request with a timeout signal, so a hung fetch can't block the caller forever", async () => {
    const fetchMock = mockFetch({ "x-fal-billable-units": "1" });
    vi.stubGlobal("fetch", fetchMock);
    await getFalBillableUnits("meta/muse-image/text-to-image", "req-6");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null when the request times out rather than hanging", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), {
      name: "AbortError",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));
    expect(await getFalBillableUnits("meta/muse-image/text-to-image", "req-7")).toBeNull();
  });
});
