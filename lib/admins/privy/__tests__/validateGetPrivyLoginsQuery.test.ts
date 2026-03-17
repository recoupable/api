import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetPrivyLoginsQuery } from "../validateGetPrivyLoginsQuery";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/admins/validateAdminAuth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";

const mockAuth = { accountId: "test-account", orgId: null, authToken: "token" };

function makeRequest(period?: string) {
  const url = period
    ? `https://example.com/api/admins/privy?period=${period}`
    : "https://example.com/api/admins/privy";
  return new NextRequest(url);
}

describe("validateGetPrivyLoginsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("returns daily period by default", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetPrivyLoginsQuery(makeRequest());

      expect(result).toEqual({ period: "daily" });
    });

    it("returns daily when period=daily", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetPrivyLoginsQuery(makeRequest("daily"));

      expect(result).toEqual({ period: "daily" });
    });

    it("returns weekly when period=weekly", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetPrivyLoginsQuery(makeRequest("weekly"));

      expect(result).toEqual({ period: "weekly" });
    });

    it("returns monthly when period=monthly", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetPrivyLoginsQuery(makeRequest("monthly"));

      expect(result).toEqual({ period: "monthly" });
    });
  });

  describe("error cases", () => {
    it("returns auth error when validateAdminAuth returns NextResponse", async () => {
      const errorResponse = NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateAdminAuth).mockResolvedValue(errorResponse);

      const result = await validateGetPrivyLoginsQuery(makeRequest());

      expect(result).toBeInstanceOf(NextResponse);
      const body = await (result as NextResponse).json();
      expect(body.status).toBe("error");
    });

    it("returns 400 for invalid period value", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(mockAuth);

      const result = await validateGetPrivyLoginsQuery(makeRequest("yearly"));

      expect(result).toBeInstanceOf(NextResponse);
      const body = await (result as NextResponse).json();
      expect(body.status).toBe("error");
    });
  });
});
