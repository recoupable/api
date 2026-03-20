import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxyChartmetricRequest } from "@/lib/chartmetric/proxyChartmetricRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { getChartmetricToken } from "@/lib/chartmetric/getChartmetricToken";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

vi.mock("@/lib/chartmetric/getChartmetricToken", () => ({
  getChartmetricToken: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("proxyChartmetricRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("error cases", () => {
    it("returns 401 when auth fails", async () => {
      const errorResponse = NextResponse.json(
        { status: "error", error: "Unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateAuthContext).mockResolvedValue(errorResponse);

      const request = new NextRequest("http://localhost/api/chartmetric/artist/123", {
        method: "GET",
      });

      const result = await proxyChartmetricRequest(request, { path: ["artist", "123"] });

      expect(result.status).toBe(401);
    });

    it("returns 402 when credits are insufficient", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "token_abc",
      });
      vi.mocked(deductCredits).mockRejectedValue(
        new Error("Insufficient credits. Required: 1, Available: 0"),
      );

      const request = new NextRequest("http://localhost/api/chartmetric/artist/123", {
        method: "GET",
      });

      const result = await proxyChartmetricRequest(request, { path: ["artist", "123"] });
      const body = await result.json();

      expect(result.status).toBe(402);
      expect(body.status).toBe("error");
      expect(body.error).toBe("Insufficient credits for Chartmetric API call");
    });

    it("returns 500 when Chartmetric API call fails", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "token_abc",
      });
      vi.mocked(deductCredits).mockResolvedValue({ success: true, newBalance: 9 });
      vi.mocked(getChartmetricToken).mockResolvedValue("cm_access_token");
      mockFetch.mockRejectedValue(new Error("Network error"));

      const request = new NextRequest("http://localhost/api/chartmetric/artist/123", {
        method: "GET",
      });

      const result = await proxyChartmetricRequest(request, { path: ["artist", "123"] });
      const body = await result.json();

      expect(result.status).toBe(500);
      expect(body.status).toBe("error");
    });
  });

  describe("successful cases", () => {
    it("successfully proxies a GET request and returns Chartmetric response", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "token_abc",
      });
      vi.mocked(deductCredits).mockResolvedValue({ success: true, newBalance: 9 });
      vi.mocked(getChartmetricToken).mockResolvedValue("cm_access_token");

      const chartmetricData = { id: 123, name: "Test Artist" };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => chartmetricData,
      });

      const request = new NextRequest("http://localhost/api/chartmetric/artist/123", {
        method: "GET",
      });

      const result = await proxyChartmetricRequest(request, { path: ["artist", "123"] });
      const body = await result.json();

      expect(result.status).toBe(200);
      expect(body).toEqual(chartmetricData);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.chartmetric.com/api/artist/123",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer cm_access_token",
          }),
        }),
      );
      expect(deductCredits).toHaveBeenCalledWith({ accountId: "acc_123", creditsToDeduct: 1 });
    });

    it("successfully proxies a POST request with body", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_456",
        orgId: null,
        authToken: "token_xyz",
      });
      vi.mocked(deductCredits).mockResolvedValue({ success: true, newBalance: 8 });
      vi.mocked(getChartmetricToken).mockResolvedValue("cm_access_token_2");

      const chartmetricData = { success: true };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => chartmetricData,
      });

      const requestBody = { filter: "test" };
      const request = new NextRequest("http://localhost/api/chartmetric/search", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: { "Content-Type": "application/json" },
      });

      const result = await proxyChartmetricRequest(request, { path: ["search"] });
      const body = await result.json();

      expect(result.status).toBe(200);
      expect(body).toEqual(chartmetricData);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.chartmetric.com/api/search",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer cm_access_token_2",
          }),
        }),
      );
    });
  });
});
