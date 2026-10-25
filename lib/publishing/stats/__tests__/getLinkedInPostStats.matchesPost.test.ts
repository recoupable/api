import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLinkedInPostStats } from "../getLinkedInPostStats";
import { proxyLinkedIn } from "@/lib/publishing/proxyLinkedIn";

vi.mock("@/lib/publishing/proxyLinkedIn", () => ({ proxyLinkedIn: vi.fn() }));

const org = "urn:li:organization:42";
const element = (key: string, urn: string, impressionCount: number) => ({
  [key]: urn,
  totalShareStatistics: { impressionCount },
});

describe("getLinkedInPostStats: picks the requested post's element", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the element whose ugcPost matches, not the first one", async () => {
    vi.mocked(proxyLinkedIn).mockResolvedValue({
      data: {
        elements: [
          element("ugcPost", "urn:li:ugcPost:1", 5),
          element("ugcPost", "urn:li:ugcPost:7", 412),
        ],
      },
      headers: {},
    });
    const stats = await getLinkedInPostStats("ca_1", org, {
      urn: "urn:li:ugcPost:7",
      kind: "ugcPosts",
    });
    expect(stats.impressions).toBe(412);
  });

  it("matches a share by its share field", async () => {
    vi.mocked(proxyLinkedIn).mockResolvedValue({
      data: { elements: [element("share", "urn:li:share:9", 33)] },
      headers: {},
    });
    const stats = await getLinkedInPostStats("ca_1", org, {
      urn: "urn:li:share:9",
      kind: "shares",
    });
    expect(stats.impressions).toBe(33);
  });

  it("returns nulls when no element names the post", async () => {
    vi.mocked(proxyLinkedIn).mockResolvedValue({
      data: { elements: [{ totalShareStatistics: { impressionCount: 5684 } }] },
      headers: {},
    });
    const stats = await getLinkedInPostStats("ca_1", org, {
      urn: "urn:li:ugcPost:7",
      kind: "ugcPosts",
    });
    expect(stats.impressions).toBeNull();
  });
});
