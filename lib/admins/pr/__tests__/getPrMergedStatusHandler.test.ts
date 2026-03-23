import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getPrMergedStatusHandler } from "../getPrMergedStatusHandler";
import { validateGetCodingPrQuery } from "../validateGetCodingPrQuery";
import { fetchGithubPrMergedStatus } from "../fetchGithubPrMergedStatus";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetCodingPrQuery", () => ({
  validateGetCodingPrQuery: vi.fn(),
}));

vi.mock("../fetchGithubPrMergedStatus", () => ({
  fetchGithubPrMergedStatus: vi.fn(),
}));

const PR_URL_1 = "https://github.com/recoupable/api/pull/42";
const PR_URL_2 = "https://github.com/recoupable/chat/pull/100";

/**
 * Creates a mock NextRequest with pull_requests query params.
 *
 * @param urls - PR URLs to include as pull_requests query params
 * @returns A NextRequest with the given pull_requests query params
 */
function makeRequest(urls: string[] = [PR_URL_1]) {
  const params = new URLSearchParams();
  urls.forEach(url => params.append("pull_requests", url));
  return new NextRequest(`https://example.com/api/admins/coding/pr?${params}`);
}

describe("getPrMergedStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("returns 200 with merged status for each PR", async () => {
      vi.mocked(validateGetCodingPrQuery).mockResolvedValue({
        pull_requests: [PR_URL_1, PR_URL_2],
      });
      vi.mocked(fetchGithubPrMergedStatus).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const response = await getPrMergedStatusHandler(makeRequest([PR_URL_1, PR_URL_2]));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.pull_requests).toEqual([
        { url: PR_URL_1, merged: true },
        { url: PR_URL_2, merged: false },
      ]);
    });

    it("returns 200 with single PR status", async () => {
      vi.mocked(validateGetCodingPrQuery).mockResolvedValue({
        pull_requests: [PR_URL_1],
      });
      vi.mocked(fetchGithubPrMergedStatus).mockResolvedValue(false);

      const response = await getPrMergedStatusHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.pull_requests).toHaveLength(1);
      expect(body.pull_requests[0]).toEqual({ url: PR_URL_1, merged: false });
    });

    it("calls fetchGithubPrMergedStatus for each PR URL", async () => {
      vi.mocked(validateGetCodingPrQuery).mockResolvedValue({
        pull_requests: [PR_URL_1, PR_URL_2],
      });
      vi.mocked(fetchGithubPrMergedStatus).mockResolvedValue(true);

      await getPrMergedStatusHandler(makeRequest([PR_URL_1, PR_URL_2]));

      expect(fetchGithubPrMergedStatus).toHaveBeenCalledWith(PR_URL_1);
      expect(fetchGithubPrMergedStatus).toHaveBeenCalledWith(PR_URL_2);
    });
  });

  describe("error cases", () => {
    it("returns auth error when validateGetCodingPrQuery returns NextResponse", async () => {
      const errorResponse = NextResponse.json(
        { status: "error", message: "Forbidden" },
        { status: 403 },
      );
      vi.mocked(validateGetCodingPrQuery).mockResolvedValue(errorResponse);

      const response = await getPrMergedStatusHandler(makeRequest());

      expect(response.status).toBe(403);
    });

    it("returns 500 when fetchGithubPrMergedStatus throws", async () => {
      vi.mocked(validateGetCodingPrQuery).mockResolvedValue({
        pull_requests: [PR_URL_1],
      });
      vi.mocked(fetchGithubPrMergedStatus).mockRejectedValue(new Error("Network error"));

      const response = await getPrMergedStatusHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
    });
  });
});
