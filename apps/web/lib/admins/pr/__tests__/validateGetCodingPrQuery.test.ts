import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetCodingPrQuery } from "../validateGetCodingPrQuery";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/admins/validateAdminAuth", () => ({
  validateAdminAuth: vi.fn(),
}));

const PR_URL = "https://github.com/recoupable/api/pull/42";
const PR_URL_2 = "https://github.com/recoupable/chat/pull/100";

/**
 * Creates a mock NextRequest with the given query params.
 *
 * @param params - Query params to include as repeated key-value pairs
 * @returns A NextRequest with the given query params
 */
function makeRequest(params: Record<string, string[]> = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, values]) =>
    values.forEach(v => searchParams.append(key, v)),
  );
  return new NextRequest(`https://example.com/api/admins/coding/pr?${searchParams}`);
}

describe("validateGetCodingPrQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAdminAuth).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "token-abc",
    });
  });

  describe("successful cases", () => {
    it("returns pull_requests array for single valid URL", async () => {
      const result = await validateGetCodingPrQuery(makeRequest({ pull_requests: [PR_URL] }));
      expect(result).toEqual({ pull_requests: [PR_URL] });
    });

    it("returns pull_requests array for multiple valid URLs", async () => {
      const result = await validateGetCodingPrQuery(
        makeRequest({ pull_requests: [PR_URL, PR_URL_2] }),
      );
      expect(result).toEqual({ pull_requests: [PR_URL, PR_URL_2] });
    });
  });

  describe("error cases", () => {
    it("returns 401 when admin auth fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(
        NextResponse.json({ status: "error" }, { status: 401 }),
      );
      const result = await validateGetCodingPrQuery(makeRequest({ pull_requests: [PR_URL] }));
      expect(result instanceof NextResponse).toBe(true);
      expect((result as NextResponse).status).toBe(401);
    });

    it("returns 400 when pull_requests is empty", async () => {
      const result = await validateGetCodingPrQuery(makeRequest({}));
      expect(result instanceof NextResponse).toBe(true);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when pull_requests contains invalid URL", async () => {
      const result = await validateGetCodingPrQuery(makeRequest({ pull_requests: ["not-a-url"] }));
      expect(result instanceof NextResponse).toBe(true);
      expect((result as NextResponse).status).toBe(400);
    });
  });
});
