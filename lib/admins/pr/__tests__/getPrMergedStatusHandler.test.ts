import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getPrStatusHandler } from "../getPrStatusHandler";
import { validateGetCodingPrQuery } from "../validateGetCodingPrQuery";
import { fetchGithubPrStatus } from "@/lib/github/fetchGithubPrStatus";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetCodingPrQuery", () => ({
  validateGetCodingPrQuery: vi.fn(),
}));

vi.mock("@/lib/github/fetchGithubPrStatus", () => ({
  fetchGithubPrStatus: vi.fn(),
}));

const PR_URL_1 = "https://github.com/recoupable/api/pull/42";
const PR_URL_2 = "https://github.com/recoupable/chat/pull/100";

/**
 * Make Request.
 *
 * @param urls - List of URLs to process.
 * @returns - Computed result.
 */
function makeRequest(urls: string[] = [PR_URL_1]) {
  const params = new URLSearchParams();
  urls.forEach(url => params.append("pull_requests", url));
  return new NextRequest(`https://example.com/api/admins/coding/pr?${params}`);
}

describe("getPrStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("returns 200 with status for each PR", async () => {
      vi.mocked(validateGetCodingPrQuery).mockResolvedValue({
        pull_requests: [PR_URL_1, PR_URL_2],
      });
      vi.mocked(fetchGithubPrStatus).mockResolvedValueOnce("merged").mockResolvedValueOnce("open");

      const response = await getPrStatusHandler(makeRequest([PR_URL_1, PR_URL_2]));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.pull_requests).toEqual([
        { url: PR_URL_1, status: "merged" },
        { url: PR_URL_2, status: "open" },
      ]);
    });

    it("returns closed status for closed PRs", async () => {
      vi.mocked(validateGetCodingPrQuery).mockResolvedValue({
        pull_requests: [PR_URL_1],
      });
      vi.mocked(fetchGithubPrStatus).mockResolvedValue("closed");

      const response = await getPrStatusHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.pull_requests[0]).toEqual({ url: PR_URL_1, status: "closed" });
    });

    it("calls fetchGithubPrStatus for each PR URL", async () => {
      vi.mocked(validateGetCodingPrQuery).mockResolvedValue({
        pull_requests: [PR_URL_1, PR_URL_2],
      });
      vi.mocked(fetchGithubPrStatus).mockResolvedValue("merged");

      await getPrStatusHandler(makeRequest([PR_URL_1, PR_URL_2]));

      expect(fetchGithubPrStatus).toHaveBeenCalledWith(PR_URL_1);
      expect(fetchGithubPrStatus).toHaveBeenCalledWith(PR_URL_2);
    });
  });

  describe("error cases", () => {
    it("returns auth error when validateGetCodingPrQuery returns NextResponse", async () => {
      const errorResponse = NextResponse.json(
        { status: "error", message: "Forbidden" },
        { status: 403 },
      );
      vi.mocked(validateGetCodingPrQuery).mockResolvedValue(errorResponse);

      const response = await getPrStatusHandler(makeRequest());

      expect(response.status).toBe(403);
    });

    it("returns 500 when fetchGithubPrStatus throws", async () => {
      vi.mocked(validateGetCodingPrQuery).mockResolvedValue({
        pull_requests: [PR_URL_1],
      });
      vi.mocked(fetchGithubPrStatus).mockRejectedValue(new Error("Network error"));

      const response = await getPrStatusHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
    });
  });
});
