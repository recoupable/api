import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAgentTemplatesHandler } from "../getAgentTemplatesHandler";

import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getUserAccessibleTemplates } from "../getUserAccessibleTemplates";
import { getSharedEmailsForTemplates } from "../getSharedEmailsForTemplates";

// Mock dependencies
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: vi.fn(),
}));

vi.mock("../getUserAccessibleTemplates", () => ({
  getUserAccessibleTemplates: vi.fn(),
}));

vi.mock("../getSharedEmailsForTemplates", () => ({
  getSharedEmailsForTemplates: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Creates a mock request with Bearer token auth
 */
function createMockBearerRequest(
  userId?: string,
  token = "test-bearer-token",
): NextRequest {
  const url = new URL("http://localhost/api/agent-templates");
  if (userId) {
    url.searchParams.set("userId", userId);
  }
  return {
    url: url.toString(),
    headers: {
      get: (name: string) =>
        name === "authorization" ? `Bearer ${token}` : null,
    },
  } as unknown as NextRequest;
}

/**
 * Creates a mock request with no auth
 */
function createMockNoAuthRequest(userId?: string): NextRequest {
  const url = new URL("http://localhost/api/agent-templates");
  if (userId) {
    url.searchParams.set("userId", userId);
  }
  return {
    url: url.toString(),
    headers: {
      get: () => null,
    },
  } as unknown as NextRequest;
}

describe("getAgentTemplatesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no auth is provided", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Authorization header with Bearer token required" },
          { status: 401 },
        ),
      );

      const request = createMockNoAuthRequest();
      const response = await getAgentTemplatesHandler(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
      expect(json.message).toBe(
        "Authorization header with Bearer token required",
      );
    });

    it("returns 401 when Bearer token validation fails", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Invalid token" },
          { status: 401 },
        ),
      );

      const request = createMockBearerRequest("user-123");
      const response = await getAgentTemplatesHandler(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid token");
    });
  });

  describe("with valid authentication", () => {
    it("returns templates for authenticated user", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          title: "Test Template",
          description: "A test template",
          prompt: "Test prompt",
          tags: ["tag1"],
          creator: "user-123",
          is_private: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 5,
          is_favourite: true,
        },
      ];

      // Expected output includes shared_emails: [] for public templates
      const expectedTemplates = mockTemplates.map((t) => ({
        ...t,
        shared_emails: [],
      }));

      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("user-123");
      vi.mocked(getUserAccessibleTemplates).mockResolvedValue(mockTemplates);
      vi.mocked(getSharedEmailsForTemplates).mockResolvedValue({});

      const request = createMockBearerRequest("user-123");
      const response = await getAgentTemplatesHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.templates).toEqual(expectedTemplates);
      expect(getUserAccessibleTemplates).toHaveBeenCalledWith("user-123");
    });

    it("includes shared emails for private templates", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          title: "Private Template",
          description: "A private template",
          prompt: "Private prompt",
          tags: ["private"],
          creator: "user-123",
          is_private: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 0,
          is_favourite: false,
        },
      ];

      const mockSharedEmails = {
        "template-1": ["shared@example.com", "another@example.com"],
      };

      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("user-123");
      vi.mocked(getUserAccessibleTemplates).mockResolvedValue(mockTemplates);
      vi.mocked(getSharedEmailsForTemplates).mockResolvedValue(mockSharedEmails);

      const request = createMockBearerRequest("user-123");
      const response = await getAgentTemplatesHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.templates[0].shared_emails).toEqual([
        "shared@example.com",
        "another@example.com",
      ]);
      expect(getSharedEmailsForTemplates).toHaveBeenCalledWith(["template-1"]);
    });

    it("does not fetch shared emails when no private templates exist", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          title: "Public Template",
          description: "A public template",
          prompt: "Public prompt",
          tags: ["public"],
          creator: "user-123",
          is_private: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 10,
          is_favourite: false,
        },
      ];

      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("user-123");
      vi.mocked(getUserAccessibleTemplates).mockResolvedValue(mockTemplates);

      const request = createMockBearerRequest("user-123");
      const response = await getAgentTemplatesHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.templates[0].shared_emails).toEqual([]);
      expect(getSharedEmailsForTemplates).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns 500 when getUserAccessibleTemplates throws", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("user-123");
      vi.mocked(getUserAccessibleTemplates).mockRejectedValue(
        new Error("Database error"),
      );

      const request = createMockBearerRequest("user-123");
      const response = await getAgentTemplatesHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Failed to fetch agent templates");
    });
  });
});
