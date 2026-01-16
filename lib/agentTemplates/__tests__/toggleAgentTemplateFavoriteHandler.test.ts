import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { toggleAgentTemplateFavoriteHandler } from "../toggleAgentTemplateFavoriteHandler";

import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import insertAgentTemplateFavorite from "@/lib/supabase/agent_template_favorites/insertAgentTemplateFavorite";
import { removeAgentTemplateFavorite } from "../removeAgentTemplateFavorite";

// Mock dependencies
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_template_favorites/insertAgentTemplateFavorite", () => ({
  default: vi.fn(),
}));

vi.mock("../removeAgentTemplateFavorite", () => ({
  removeAgentTemplateFavorite: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Creates a mock POST request with Bearer token auth
 */
function createMockBearerRequest(
  body: { templateId?: string; isFavourite?: boolean },
  token = "test-bearer-token",
): NextRequest {
  const url = new URL("http://localhost/api/agent-templates/favorites");
  return {
    url: url.toString(),
    method: "POST",
    headers: {
      get: (name: string) => (name === "authorization" ? `Bearer ${token}` : null),
    },
    json: async () => body,
  } as unknown as NextRequest;
}

/**
 * Creates a mock request with no auth
 */
function createMockNoAuthRequest(body: { templateId?: string; isFavourite?: boolean }): NextRequest {
  const url = new URL("http://localhost/api/agent-templates/favorites");
  return {
    url: url.toString(),
    method: "POST",
    headers: {
      get: () => null,
    },
    json: async () => body,
  } as unknown as NextRequest;
}

describe("toggleAgentTemplateFavoriteHandler", () => {
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

      const request = createMockNoAuthRequest({ templateId: "template-1", isFavourite: true });
      const response = await toggleAgentTemplateFavoriteHandler(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Authorization header with Bearer token required");
    });

    it("returns 401 when Bearer token validation fails", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue(
        NextResponse.json({ status: "error", message: "Invalid token" }, { status: 401 }),
      );

      const request = createMockBearerRequest({ templateId: "template-1", isFavourite: true });
      const response = await toggleAgentTemplateFavoriteHandler(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid token");
    });
  });

  describe("validation", () => {
    it("returns 400 when templateId is missing", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("user-123");

      const request = createMockBearerRequest({ isFavourite: true });
      const response = await toggleAgentTemplateFavoriteHandler(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Missing templateId");
    });

    it("returns 400 when isFavourite is missing", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("user-123");

      const request = createMockBearerRequest({ templateId: "template-1" });
      const response = await toggleAgentTemplateFavoriteHandler(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Missing isFavourite");
    });
  });

  describe("with valid authentication", () => {
    it("adds favorite when isFavourite is true", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("user-123");
      vi.mocked(insertAgentTemplateFavorite).mockResolvedValue({ success: true });

      const request = createMockBearerRequest({ templateId: "template-1", isFavourite: true });
      const response = await toggleAgentTemplateFavoriteHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(insertAgentTemplateFavorite).toHaveBeenCalledWith({ templateId: "template-1", userId: "user-123" });
      expect(removeAgentTemplateFavorite).not.toHaveBeenCalled();
    });

    it("removes favorite when isFavourite is false", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("user-123");
      vi.mocked(removeAgentTemplateFavorite).mockResolvedValue({ success: true });

      const request = createMockBearerRequest({ templateId: "template-1", isFavourite: false });
      const response = await toggleAgentTemplateFavoriteHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(removeAgentTemplateFavorite).toHaveBeenCalledWith("template-1", "user-123");
      expect(insertAgentTemplateFavorite).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns 500 when insertAgentTemplateFavorite throws", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("user-123");
      vi.mocked(insertAgentTemplateFavorite).mockRejectedValue(new Error("Database error"));

      const request = createMockBearerRequest({ templateId: "template-1", isFavourite: true });
      const response = await toggleAgentTemplateFavoriteHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Failed to toggle favorite");
    });

    it("returns 500 when removeAgentTemplateFavorite throws", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("user-123");
      vi.mocked(removeAgentTemplateFavorite).mockRejectedValue(new Error("Database error"));

      const request = createMockBearerRequest({ templateId: "template-1", isFavourite: false });
      const response = await toggleAgentTemplateFavoriteHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Failed to toggle favorite");
    });
  });
});
