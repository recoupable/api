import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getPrivyLoginsHandler } from "../getPrivyLoginsHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetPrivyLoginsQuery", () => ({
  validateGetPrivyLoginsQuery: vi.fn(),
}));

vi.mock("../fetchPrivyLogins", () => ({
  fetchPrivyLogins: vi.fn(),
}));

import { validateGetPrivyLoginsQuery } from "../validateGetPrivyLoginsQuery";
import { fetchPrivyLogins } from "../fetchPrivyLogins";

const now = Date.now();
const ONE_HOUR_AGO = Math.floor((now - 60 * 60 * 1000) / 1000);
const TWO_HOURS_AGO = Math.floor((now - 2 * 60 * 60 * 1000) / 1000);

const mockLogins = [
  {
    id: "did:privy:abc123",
    created_at: ONE_HOUR_AGO,
    linked_accounts: [
      { type: "email", address: "user@example.com", latest_verified_at: ONE_HOUR_AGO },
    ],
    has_accepted_terms: true,
    is_guest: false,
    mfa_methods: [],
  },
  {
    id: "did:privy:def456",
    created_at: TWO_HOURS_AGO,
    linked_accounts: [],
    has_accepted_terms: false,
    is_guest: true,
    mfa_methods: [],
  },
];

function makeRequest(period = "daily") {
  return new NextRequest(`https://example.com/api/admins/privy?period=${period}`);
}

describe("getPrivyLoginsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("returns 200 with logins, total_new, and total_active", async () => {
      vi.mocked(validateGetPrivyLoginsQuery).mockResolvedValue({ period: "daily" });
      vi.mocked(fetchPrivyLogins).mockResolvedValue(mockLogins);

      const response = await getPrivyLoginsHandler(makeRequest("daily"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.total).toBe(2);
      expect(body.total_new).toBe(2);
      expect(body.total_active).toBe(1);
      expect(body.logins).toEqual(mockLogins);
    });

    it("returns 200 with zero counts when no logins exist", async () => {
      vi.mocked(validateGetPrivyLoginsQuery).mockResolvedValue({ period: "weekly" });
      vi.mocked(fetchPrivyLogins).mockResolvedValue([]);

      const response = await getPrivyLoginsHandler(makeRequest("weekly"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.total).toBe(0);
      expect(body.total_new).toBe(0);
      expect(body.total_active).toBe(0);
      expect(body.logins).toEqual([]);
    });

    it("passes the period to fetchPrivyLogins", async () => {
      vi.mocked(validateGetPrivyLoginsQuery).mockResolvedValue({ period: "monthly" });
      vi.mocked(fetchPrivyLogins).mockResolvedValue([]);

      await getPrivyLoginsHandler(makeRequest("monthly"));

      expect(fetchPrivyLogins).toHaveBeenCalledWith("monthly");
    });
  });

  describe("error cases", () => {
    it("returns auth error when validateGetPrivyLoginsQuery returns NextResponse", async () => {
      const errorResponse = NextResponse.json(
        { status: "error", message: "Forbidden" },
        { status: 403 },
      );
      vi.mocked(validateGetPrivyLoginsQuery).mockResolvedValue(errorResponse);

      const response = await getPrivyLoginsHandler(makeRequest());

      expect(response.status).toBe(403);
    });

    it("returns 500 when fetchPrivyLogins throws", async () => {
      vi.mocked(validateGetPrivyLoginsQuery).mockResolvedValue({ period: "daily" });
      vi.mocked(fetchPrivyLogins).mockRejectedValue(new Error("Privy API error"));

      const response = await getPrivyLoginsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
    });
  });
});
