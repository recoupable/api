import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getChatsHandler } from "../getChatsHandler";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectRooms } from "@/lib/supabase/rooms/selectRooms";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/selectRooms", () => ({
  selectRooms: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-org-id",
}));

/**
 * Creates a mock NextRequest with the given URL and headers.
 *
 * @param url - The URL for the request
 * @param apiKey - The API key header value
 * @returns A mock NextRequest
 */
function createMockRequest(url: string, apiKey = "test-api-key"): NextRequest {
  return {
    url,
    headers: {
      get: (name: string) => (name === "x-api-key" ? apiKey : null),
    },
  } as unknown as NextRequest;
}

describe("getChatsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns auth error when validateAuthContext fails", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
      expect(selectRooms).not.toHaveBeenCalled();
    });
  });

  describe("personal key behavior", () => {
    it("returns chats for personal key owner without account_id param", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const mockChats = [
        {
          id: "chat-1",
          account_id: accountId,
          artist_id: null,
          topic: "Chat 1",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null, // Personal key
        authToken: "test-token",
      });
      vi.mocked(selectRooms).mockResolvedValue(mockChats);

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.chats).toEqual(mockChats);
      expect(selectRooms).toHaveBeenCalledWith({
        account_ids: [accountId],
        artist_id: undefined,
      });
    });

    it("returns 403 when personal key tries to filter by account_id", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const otherAccountId = "223e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null, // Personal key
        authToken: "test-token",
      });
      vi.mocked(canAccessAccount).mockResolvedValue(false);

      const request = createMockRequest(`http://localhost/api/chats?account_id=${otherAccountId}`);
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.status).toBe("error");
      expect(json.error).toBe("Personal API keys cannot filter by account_id");
      expect(selectRooms).not.toHaveBeenCalled();
    });
  });

  describe("org key behavior", () => {
    it("returns chats for all org members without account_id param", async () => {
      const orgId = "123e4567-e89b-12d3-a456-426614174000";
      const mockChats = [
        {
          id: "chat-1",
          account_id: "member-1",
          artist_id: null,
          topic: "Chat 1",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "chat-2",
          account_id: "member-2",
          artist_id: null,
          topic: "Chat 2",
          updated_at: "2024-01-02T00:00:00Z",
        },
      ];

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: orgId,
        orgId,
        authToken: "test-token",
      });
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        { account_id: "member-1", organization_id: orgId, organization: null },
        { account_id: "member-2", organization_id: orgId, organization: null },
      ]);
      vi.mocked(selectRooms).mockResolvedValue(mockChats);

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.chats).toEqual(mockChats);
      expect(selectRooms).toHaveBeenCalledWith({
        account_ids: ["member-1", "member-2"],
        artist_id: undefined,
      });
    });

    it("allows org key to filter by account_id for org member", async () => {
      const orgId = "123e4567-e89b-12d3-a456-426614174000";
      const memberId = "223e4567-e89b-12d3-a456-426614174000";
      const mockChats = [
        {
          id: "chat-1",
          account_id: memberId,
          artist_id: null,
          topic: "Chat 1",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: orgId,
        orgId,
        authToken: "test-token",
      });
      vi.mocked(canAccessAccount).mockResolvedValue(true);
      vi.mocked(selectRooms).mockResolvedValue(mockChats);

      const request = createMockRequest(`http://localhost/api/chats?account_id=${memberId}`);
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(selectRooms).toHaveBeenCalledWith({
        account_ids: [memberId],
        artist_id: undefined,
      });
    });

    it("returns 403 when org key tries to access non-member account", async () => {
      const orgId = "123e4567-e89b-12d3-a456-426614174000";
      const nonMemberId = "323e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: orgId,
        orgId,
        authToken: "test-token",
      });
      vi.mocked(canAccessAccount).mockResolvedValue(false);

      const request = createMockRequest(`http://localhost/api/chats?account_id=${nonMemberId}`);
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.status).toBe("error");
      expect(json.error).toBe("account_id is not a member of this organization");
      expect(selectRooms).not.toHaveBeenCalled();
    });
  });

  describe("Recoup admin key behavior", () => {
    it("returns all chats without account_id param", async () => {
      const recoupOrgId = "recoup-org-id";
      const mockChats = [
        {
          id: "chat-1",
          account_id: "any-account",
          artist_id: null,
          topic: "Chat 1",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: recoupOrgId,
        orgId: recoupOrgId,
        authToken: "test-token",
      });
      vi.mocked(selectRooms).mockResolvedValue(mockChats);

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(selectRooms).toHaveBeenCalledWith({
        artist_id: undefined,
      });
    });
  });

  describe("validation", () => {
    it("returns 400 when account_id is invalid UUID", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "auth-account-id",
        orgId: null,
        authToken: "test-token",
      });

      const request = createMockRequest("http://localhost/api/chats?account_id=invalid");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.status).toBe("error");
      expect(selectRooms).not.toHaveBeenCalled();
    });

    it("returns 400 when artist_account_id is invalid UUID", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "auth-account-id",
        orgId: null,
        authToken: "test-token",
      });

      const request = createMockRequest("http://localhost/api/chats?artist_account_id=invalid");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.status).toBe("error");
      expect(selectRooms).not.toHaveBeenCalled();
    });
  });

  describe("successful responses", () => {
    it("returns filtered chats when artist_account_id is provided", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const artistId = "223e4567-e89b-12d3-a456-426614174001";
      const mockChats = [
        {
          id: "chat-1",
          account_id: accountId,
          artist_id: artistId,
          topic: "Artist Chat",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null, // Personal key
        authToken: "test-token",
      });
      vi.mocked(selectRooms).mockResolvedValue(mockChats);

      const request = createMockRequest(`http://localhost/api/chats?artist_account_id=${artistId}`);
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.chats).toEqual(mockChats);
      expect(selectRooms).toHaveBeenCalledWith({
        account_ids: [accountId],
        artist_id: artistId,
      });
    });

    it("returns empty array when no chats found", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectRooms).mockResolvedValue([]);

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.chats).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("returns 500 when selectRooms returns null", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectRooms).mockResolvedValue(null);

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.error).toBe("Failed to retrieve chats");
    });

    it("returns 500 when an exception is thrown", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectRooms).mockRejectedValue(new Error("Database error"));

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.error).toBe("Database error");
    });
  });
});
