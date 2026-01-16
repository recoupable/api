import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getArtistAgentsHandler } from "../getArtistAgentsHandler";

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getArtistAgents } from "../getArtistAgents";

// Mock dependencies
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: vi.fn(),
}));

vi.mock("../getArtistAgents", () => ({
  getArtistAgents: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Creates a mock request with API key auth and socialId query params
 */
function createMockRequest(
  socialIds: string[] = [],
  apiKey = "test-api-key",
): NextRequest {
  const url = new URL("http://localhost/api/artist-agents");
  socialIds.forEach((id) => url.searchParams.append("socialId", id));
  return {
    url: url.toString(),
    headers: {
      get: (name: string) => (name === "x-api-key" ? apiKey : null),
    },
  } as unknown as NextRequest;
}

/**
 * Creates a mock request with Bearer token auth
 */
function createMockBearerRequest(
  socialIds: string[] = [],
  token = "test-bearer-token",
): NextRequest {
  const url = new URL("http://localhost/api/artist-agents");
  socialIds.forEach((id) => url.searchParams.append("socialId", id));
  return {
    url: url.toString(),
    headers: {
      get: (name: string) => (name === "authorization" ? `Bearer ${token}` : null),
    },
  } as unknown as NextRequest;
}

/**
 * Creates a mock request with no auth
 */
function createMockNoAuthRequest(socialIds: string[] = []): NextRequest {
  const url = new URL("http://localhost/api/artist-agents");
  socialIds.forEach((id) => url.searchParams.append("socialId", id));
  return {
    url: url.toString(),
    headers: {
      get: () => null,
    },
  } as unknown as NextRequest;
}

describe("getArtistAgentsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("returns 400 when no socialId is provided", async () => {
      vi.mocked(getApiKeyAccountId).mockResolvedValue("account-123");

      const request = createMockRequest([]);
      const response = await getArtistAgentsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.status).toBe("error");
      expect(json.message).toBe("At least one socialId is required");
    });
  });

  describe("with API key authentication", () => {
    it("returns agents for valid socialIds", async () => {
      const mockAgents = [
        { type: "twitter", agentId: "agent-1", updated_at: "2024-01-01T00:00:00Z" },
        { type: "instagram", agentId: "agent-2", updated_at: "2024-01-02T00:00:00Z" },
      ];

      vi.mocked(getApiKeyAccountId).mockResolvedValue("account-123");
      vi.mocked(getArtistAgents).mockResolvedValue(mockAgents);

      const request = createMockRequest(["social-1", "social-2"]);
      const response = await getArtistAgentsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.agents).toEqual(mockAgents);
      expect(getArtistAgents).toHaveBeenCalledWith(["social-1", "social-2"]);
    });

    it("returns 401 when API key validation fails", async () => {
      vi.mocked(getApiKeyAccountId).mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Invalid API key" },
          { status: 401 },
        ),
      );

      const request = createMockRequest(["social-1"]);
      const response = await getArtistAgentsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid API key");
      expect(getArtistAgents).not.toHaveBeenCalled();
    });
  });

  describe("with Bearer token authentication", () => {
    it("returns agents for valid socialIds with Bearer token", async () => {
      const mockAgents = [
        { type: "spotify", agentId: "agent-3", updated_at: "2024-01-03T00:00:00Z" },
      ];

      vi.mocked(getAuthenticatedAccountId).mockResolvedValue("bearer-account-123");
      vi.mocked(getArtistAgents).mockResolvedValue(mockAgents);

      const request = createMockBearerRequest(["social-1"]);
      const response = await getArtistAgentsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.agents).toEqual(mockAgents);
      expect(getApiKeyAccountId).not.toHaveBeenCalled();
      expect(getAuthenticatedAccountId).toHaveBeenCalledWith(request);
    });

    it("returns 401 when Bearer token validation fails", async () => {
      vi.mocked(getAuthenticatedAccountId).mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Invalid token" },
          { status: 401 },
        ),
      );

      const request = createMockBearerRequest(["social-1"]);
      const response = await getArtistAgentsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid token");
      expect(getArtistAgents).not.toHaveBeenCalled();
    });
  });

  describe("auth mechanism enforcement", () => {
    it("returns 401 when no auth is provided", async () => {
      const request = createMockNoAuthRequest(["social-1"]);
      const response = await getArtistAgentsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
      expect(json.message).toBe(
        "Exactly one of x-api-key or Authorization must be provided",
      );
      expect(getArtistAgents).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns 500 when getArtistAgents throws", async () => {
      vi.mocked(getApiKeyAccountId).mockResolvedValue("account-123");
      vi.mocked(getArtistAgents).mockRejectedValue(new Error("Database error"));

      const request = createMockRequest(["social-1"]);
      const response = await getArtistAgentsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.message).toBe("Failed to fetch artist agents");
    });
  });
});
