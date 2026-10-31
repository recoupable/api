import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLinkedInVideoStats } from "../getLinkedInVideoStats";
import { proxyLinkedIn } from "@/lib/publishing/proxyLinkedIn";

vi.mock("@/lib/publishing/proxyLinkedIn", () => ({ proxyLinkedIn: vi.fn() }));

const urn = "urn:li:ugcPost:77";
const url = (type: string) =>
  `https://api.linkedin.com/rest/videoAnalytics?q=entity&entity=urn%3Ali%3AugcPost%3A77&type=${type}&aggregation=ALL`;
const values: Record<string, number> = { VIDEO_VIEW: 340, VIEWER: 210, TIME_WATCHED: 912000 };

describe("getLinkedInVideoStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads VIDEO_VIEW, VIEWER and TIME_WATCHED and maps elements[0].value", async () => {
    vi.mocked(proxyLinkedIn).mockImplementation(async (_c, _m, endpoint) => {
      const type = new URL(endpoint).searchParams.get("type") as string;
      return { data: { elements: [{ value: values[type] }] }, headers: {} };
    });

    const stats = await getLinkedInVideoStats("ca_1", urn);

    expect(proxyLinkedIn).toHaveBeenCalledTimes(3);
    for (const type of ["VIDEO_VIEW", "VIEWER", "TIME_WATCHED"]) {
      expect(proxyLinkedIn).toHaveBeenCalledWith("ca_1", "GET", url(type));
    }
    expect(stats).toEqual({ video_views: 340, viewers: 210, watch_time_ms: 912000 });
  });

  it("returns nulls when LinkedIn returns no elements", async () => {
    vi.mocked(proxyLinkedIn).mockResolvedValue({ data: {}, headers: {} });
    expect(await getLinkedInVideoStats("ca_1", urn)).toEqual({
      video_views: null,
      viewers: null,
      watch_time_ms: null,
    });
  });

  it("returns nulls instead of throwing when the video read is rejected", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(proxyLinkedIn).mockResolvedValueOnce({
      data: { elements: [{ value: 5 }] },
      headers: {},
    });
    vi.mocked(proxyLinkedIn).mockRejectedValue(new Error("returned 403"));

    expect(await getLinkedInVideoStats("ca_1", urn)).toEqual({
      video_views: null,
      viewers: null,
      watch_time_ms: null,
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
