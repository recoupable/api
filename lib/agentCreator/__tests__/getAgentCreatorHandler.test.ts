import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getAgentCreatorHandler } from "../getAgentCreatorHandler";

import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { ADMIN_EMAILS } from "@/lib/admin";

// Mock dependencies
vi.mock("@/lib/supabase/accounts/getAccountWithDetails", () => ({
  getAccountWithDetails: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  ADMIN_EMAILS: ["admin@example.com"],
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Creates a mock request with creatorId query param
 *
 * @param creatorId
 */
function createMockRequest(creatorId?: string): NextRequest {
  const url = new URL("http://localhost/api/agent-creator");
  if (creatorId) {
    url.searchParams.set("creatorId", creatorId);
  }
  return {
    url: url.toString(),
    nextUrl: {
      searchParams: url.searchParams,
    },
  } as unknown as NextRequest;
}

describe("getAgentCreatorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("returns 400 when creatorId is missing", async () => {
      const request = createMockRequest();
      const response = await getAgentCreatorHandler(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.message).toBe("Missing creatorId");
    });
  });

  describe("successful responses", () => {
    it("returns creator info with name and image", async () => {
      vi.mocked(getAccountWithDetails).mockResolvedValue({
        id: "creator-123",
        name: "Test Creator",
        created_at: "2024-01-01T00:00:00Z",
        organization_id: null,
        image: "https://example.com/avatar.jpg",
        email: "testcreator@example.com",
        wallet: null,
        account_id: "creator-123",
      });

      const request = createMockRequest("creator-123");
      const response = await getAgentCreatorHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.creator).toEqual({
        name: "Test Creator",
        image: "https://example.com/avatar.jpg",
        is_admin: false,
      });
      expect(getAccountWithDetails).toHaveBeenCalledWith("creator-123");
    });

    it("returns is_admin true for admin emails", async () => {
      vi.mocked(getAccountWithDetails).mockResolvedValue({
        id: "admin-123",
        name: "Admin User",
        created_at: "2024-01-01T00:00:00Z",
        organization_id: null,
        image: "https://example.com/admin.jpg",
        email: "admin@example.com", // This matches ADMIN_EMAILS mock
        wallet: null,
        account_id: "admin-123",
      });

      const request = createMockRequest("admin-123");
      const response = await getAgentCreatorHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.creator.is_admin).toBe(true);
    });

    it("returns null values when account has no name or image", async () => {
      vi.mocked(getAccountWithDetails).mockResolvedValue({
        id: "creator-456",
        name: null,
        created_at: "2024-01-01T00:00:00Z",
        organization_id: null,
        image: undefined,
        email: "noinfo@example.com",
        wallet: null,
        account_id: "creator-456",
      });

      const request = createMockRequest("creator-456");
      const response = await getAgentCreatorHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.creator).toEqual({
        name: null,
        image: null,
        is_admin: false,
      });
    });
  });

  describe("error handling", () => {
    it("returns 404 when creator not found", async () => {
      vi.mocked(getAccountWithDetails).mockResolvedValue(null);

      const request = createMockRequest("nonexistent-123");
      const response = await getAgentCreatorHandler(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.message).toBe("Creator not found");
    });

    it("returns 400 when database query throws", async () => {
      vi.mocked(getAccountWithDetails).mockRejectedValue(new Error("Database error"));

      const request = createMockRequest("creator-123");
      const response = await getAgentCreatorHandler(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.message).toBe("Database error");
    });
  });
});
