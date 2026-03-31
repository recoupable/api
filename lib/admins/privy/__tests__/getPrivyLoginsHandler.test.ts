import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getPrivyLoginsHandler } from "../getPrivyLoginsHandler";

import { validateGetPrivyLoginsQuery } from "../validateGetPrivyLoginsQuery";
import { fetchPrivyLogins } from "../fetchPrivyLogins";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetPrivyLoginsQuery", () => ({
  validateGetPrivyLoginsQuery: vi.fn(),
}));

vi.mock("../fetchPrivyLogins", () => ({
  fetchPrivyLogins: vi.fn(),
}));

// Use timestamps guaranteed to be after today's midnight UTC
const nowUtc = new Date();
const todayMidnightUtc = Date.UTC(
  nowUtc.getUTCFullYear(),
  nowUtc.getUTCMonth(),
  nowUtc.getUTCDate(),
);
const AFTER_MIDNIGHT_1 = Math.floor((todayMidnightUtc + 60 * 1000) / 1000); // 1 min after midnight
const AFTER_MIDNIGHT_2 = Math.floor((todayMidnightUtc + 2 * 60 * 1000) / 1000); // 2 min after midnight

const mockLogins = [
  {
    id: "did:privy:abc123",
    created_at: AFTER_MIDNIGHT_1,
    linked_accounts: [
      { type: "email", address: "user@example.com", latest_verified_at: AFTER_MIDNIGHT_1 },
    ],
    has_accepted_terms: true,
    is_guest: false,
    mfa_methods: [],
  },
  {
    id: "did:privy:def456",
    created_at: AFTER_MIDNIGHT_2,
    linked_accounts: [],
    has_accepted_terms: false,
    is_guest: true,
    mfa_methods: [],
  },
];

/**
 * Creates a NextRequest targeting the Privy logins endpoint with the given period query param.
 *
 * @param period - The time period to filter logins by (e.g., "daily", "weekly", "monthly", "all").
 * @returns A NextRequest instance for the Privy logins admin endpoint.
 */
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
      vi.mocked(fetchPrivyLogins).mockResolvedValue({ users: mockLogins, totalPrivyUsers: 10 });

      const response = await getPrivyLoginsHandler(makeRequest("daily"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.total).toBe(10);
      expect(body.total_new).toBe(2);
      expect(body.total_active).toBe(2);
      expect(body.total_privy_users).toBeUndefined();
      expect(body.logins).toEqual(mockLogins);
    });

    it("returns 200 with zero counts when no logins exist", async () => {
      vi.mocked(validateGetPrivyLoginsQuery).mockResolvedValue({ period: "weekly" });
      vi.mocked(fetchPrivyLogins).mockResolvedValue({ users: [], totalPrivyUsers: 0 });

      const response = await getPrivyLoginsHandler(makeRequest("weekly"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.total).toBe(0);
      expect(body.total_new).toBe(0);
      expect(body.total_active).toBe(0);
      expect(body.total_privy_users).toBeUndefined();
      expect(body.logins).toEqual([]);
    });

    it("passes the period to fetchPrivyLogins", async () => {
      vi.mocked(validateGetPrivyLoginsQuery).mockResolvedValue({ period: "monthly" });
      vi.mocked(fetchPrivyLogins).mockResolvedValue({ users: [], totalPrivyUsers: 0 });

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
