import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLinkedInPostStats } from "../getLinkedInPostStats";
import { proxyLinkedIn } from "@/lib/publishing/proxyLinkedIn";

vi.mock("@/lib/publishing/proxyLinkedIn", () => ({ proxyLinkedIn: vi.fn() }));

const org = "urn:li:organization:42";

describe("getLinkedInPostStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads organizationalEntityShareStatistics for a ugcPost and maps the totals", async () => {
    vi.mocked(proxyLinkedIn).mockResolvedValue({
      data: {
        elements: [
          {
            ugcPost: "urn:li:ugcPost:7",
            totalShareStatistics: {
              impressionCount: 900,
              uniqueImpressionsCount: 700,
              clickCount: 30,
              likeCount: 12,
              commentCount: 3,
              shareCount: 2,
              engagement: 0.052,
            },
          },
        ],
      },
      headers: {},
    });

    const stats = await getLinkedInPostStats("ca_1", org, {
      urn: "urn:li:ugcPost:7",
      kind: "ugcPosts",
    });

    expect(proxyLinkedIn).toHaveBeenCalledWith(
      "ca_1",
      "GET",
      "https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn%3Ali%3Aorganization%3A42&ugcPosts=List(urn%3Ali%3AugcPost%3A7)",
    );
    expect(stats).toEqual({
      impressions: 900,
      unique_impressions: 700,
      clicks: 30,
      likes: 12,
      comments: 3,
      shares: 2,
      engagement: 0.052,
    });
  });

  it("uses shares=List(...) for a share URN and nulls missing numbers", async () => {
    vi.mocked(proxyLinkedIn).mockResolvedValue({
      data: {
        elements: [{ share: "urn:li:share:9", totalShareStatistics: { impressionCount: 5 } }],
      },
      headers: {},
    });

    const stats = await getLinkedInPostStats("ca_1", org, {
      urn: "urn:li:share:9",
      kind: "shares",
    });

    expect(vi.mocked(proxyLinkedIn).mock.calls[0][2]).toContain(
      "&shares=List(urn%3Ali%3Ashare%3A9)",
    );
    expect(stats).toEqual({
      impressions: 5,
      unique_impressions: null,
      clicks: null,
      likes: null,
      comments: null,
      shares: null,
      engagement: null,
    });
  });

  it("returns all nulls when LinkedIn returns no elements", async () => {
    vi.mocked(proxyLinkedIn).mockResolvedValue({ data: {}, headers: {} });
    const stats = await getLinkedInPostStats("ca_1", org, {
      urn: "urn:li:share:9",
      kind: "shares",
    });
    expect(Object.values(stats).every(v => v === null)).toBe(true);
  });
});
