import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/admins/validateAdminAuth", () => ({
  validateAdminAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/account_api_keys/getAgentSignups", () => ({
  getAgentSignups: vi.fn(),
}));

import { getAgentSignupsHandler } from "../getAgentSignupsHandler";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { getAgentSignups } from "@/lib/supabase/account_api_keys/getAgentSignups";
import type { AgentSignupRow } from "@/lib/supabase/account_api_keys/getAgentSignups";
import { NextResponse } from "next/server";

function makeRequest(period?: string): NextRequest {
  const url = new URL("http://localhost/api/admins/agent-signups");
  if (period) url.searchParams.set("period", period);
  return new NextRequest(url);
}

const mockSignups: AgentSignupRow[] = [
  {
    id: "key-1",
    name: "Agent Key 1",
    email: "agent+bot1@example.com",
    created_at: "2026-04-10T12:00:00.000Z",
  },
  {
    id: "key-2",
    name: "Agent Key 2",
    email: "agent+bot2@example.com",
    created_at: "2026-04-09T08:00:00.000Z",
  },
];

describe("getAgentSignupsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("returns agent signups with default period (all)", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        accountId: "admin-1",
        orgId: null,
        authToken: "token",
      });
      vi.mocked(getAgentSignups).mockResolvedValue(mockSignups);

      const response = await getAgentSignupsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("success");
      expect(body.total).toBe(2);
      expect(body.signups).toHaveLength(2);
      expect(body.signups[0].email).toBe("agent+bot1@example.com");
      expect(getAgentSignups).toHaveBeenCalledWith(undefined);
    });

    it("returns filtered signups for daily period", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        accountId: "admin-1",
        orgId: null,
        authToken: "token",
      });
      vi.mocked(getAgentSignups).mockResolvedValue([mockSignups[0]]);

      const response = await getAgentSignupsHandler(makeRequest("daily"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.total).toBe(1);
      expect(getAgentSignups).toHaveBeenCalledWith(expect.any(String));
    });

    it("returns empty array when no agent signups exist", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        accountId: "admin-1",
        orgId: null,
        authToken: "token",
      });
      vi.mocked(getAgentSignups).mockResolvedValue([]);

      const response = await getAgentSignupsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.total).toBe(0);
      expect(body.signups).toEqual([]);
    });
  });

  describe("error cases", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Unauthorized" },
          { status: 401 },
        ),
      );

      const response = await getAgentSignupsHandler(makeRequest());
      expect(response.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Forbidden" },
          { status: 403 },
        ),
      );

      const response = await getAgentSignupsHandler(makeRequest());
      expect(response.status).toBe(403);
    });

    it("returns 400 for invalid period", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        accountId: "admin-1",
        orgId: null,
        authToken: "token",
      });

      const response = await getAgentSignupsHandler(makeRequest("invalid"));
      expect(response.status).toBe(400);
    });

    it("returns 500 on unexpected error", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        accountId: "admin-1",
        orgId: null,
        authToken: "token",
      });
      vi.mocked(getAgentSignups).mockRejectedValue(new Error("DB failure"));

      const response = await getAgentSignupsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
      expect(body.message).toBe("Internal server error");
    });
  });
});
