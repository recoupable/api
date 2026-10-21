import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetSlackTagsQuery } from "../validateGetSlackTagsQuery";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/admins/validateAdminAuth", () => ({
  validateAdminAuth: vi.fn(),
}));

const mockAuth = { accountId: "test-account", orgId: null, authToken: "token" };

/**
 *
 * @param period
 */
function makeRequest(period?: string) {
  const url = period
    ? `https://example.com/api/admins/coding/slack?period=${period}`
    : "https://example.com/api/admins/coding/slack";
  return new NextRequest(url);
}

describe("validateGetSlackTagsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("retains the selected Slack user ID alongside the period", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetSlackTagsQuery(
        new NextRequest("https://example.com/api/admins/coding/slack?period=weekly&tag=U012AB3CD"),
      );

      expect(result).toEqual({ period: "weekly", tag: "U012AB3CD" });
    });
    it("returns all period by default", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetSlackTagsQuery(makeRequest());

      expect(result).toEqual({ period: "all" });
    });

    it("returns daily when period=daily", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetSlackTagsQuery(makeRequest("daily"));

      expect(result).toEqual({ period: "daily" });
    });

    it("returns weekly when period=weekly", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetSlackTagsQuery(makeRequest("weekly"));

      expect(result).toEqual({ period: "weekly" });
    });

    it("returns monthly when period=monthly", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetSlackTagsQuery(makeRequest("monthly"));

      expect(result).toEqual({ period: "monthly" });
    });
  });

  describe("error cases", () => {
    it("rejects a blank tag", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetSlackTagsQuery(
        new NextRequest("https://example.com/api/admins/coding/slack?tag=%20%20"),
      );

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
    it("returns auth error when validateAdminAuth returns NextResponse", async () => {
      const errorResponse = NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateAdminAuth).mockResolvedValue(errorResponse);

      const result = await validateGetSlackTagsQuery(makeRequest());

      expect(result).toBeInstanceOf(NextResponse);
      const body = await (result as NextResponse).json();
      expect(body.status).toBe("error");
    });

    it("returns 400 for invalid period value", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetSlackTagsQuery(makeRequest("yearly"));

      expect(result).toBeInstanceOf(NextResponse);
      const body = await (result as NextResponse).json();
      expect(body.status).toBe("error");
    });
  });
});
