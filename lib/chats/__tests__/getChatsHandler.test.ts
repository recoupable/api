import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getChatsHandler } from "../getChatsHandler";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectRoomsByAccountId } from "@/lib/supabase/rooms/selectRoomsByAccountId";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/selectRoomsByAccountId", () => ({
  selectRoomsByAccountId: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
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

      const request = createMockRequest("http://localhost/api/chats?account_id=123");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
      expect(selectRoomsByAccountId).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("returns 400 when account_id is missing", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "auth-account-id",
        orgId: null,
        authToken: "test-token",
      });

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.status).toBe("error");
      expect(selectRoomsByAccountId).not.toHaveBeenCalled();
    });

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
      expect(selectRoomsByAccountId).not.toHaveBeenCalled();
    });
  });

  describe("successful responses", () => {
    it("returns chats for valid account_id", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const mockChats = [
        {
          id: "chat-1",
          account_id: accountId,
          artist_id: null,
          topic: "Chat 1",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "chat-2",
          account_id: accountId,
          artist_id: null,
          topic: "Chat 2",
          updated_at: "2024-01-02T00:00:00Z",
        },
      ];

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "auth-account-id",
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectRoomsByAccountId).mockResolvedValue(mockChats);

      const request = createMockRequest(`http://localhost/api/chats?account_id=${accountId}`);
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.chats).toEqual(mockChats);
      expect(selectRoomsByAccountId).toHaveBeenCalledWith({
        accountId,
        artistId: undefined,
      });
    });

    it("returns filtered chats when artist_account_id is provided", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const artistId = "123e4567-e89b-12d3-a456-426614174001";
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
        accountId: "auth-account-id",
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectRoomsByAccountId).mockResolvedValue(mockChats);

      const request = createMockRequest(
        `http://localhost/api/chats?account_id=${accountId}&artist_account_id=${artistId}`,
      );
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.chats).toEqual(mockChats);
      expect(selectRoomsByAccountId).toHaveBeenCalledWith({
        accountId,
        artistId,
      });
    });

    it("returns empty array when no chats found", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "auth-account-id",
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectRoomsByAccountId).mockResolvedValue([]);

      const request = createMockRequest(`http://localhost/api/chats?account_id=${accountId}`);
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.chats).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("returns 500 when selectRoomsByAccountId returns null", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "auth-account-id",
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectRoomsByAccountId).mockResolvedValue(null);

      const request = createMockRequest(`http://localhost/api/chats?account_id=${accountId}`);
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.error).toBe("Failed to retrieve chats");
    });

    it("returns 500 when an exception is thrown", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "auth-account-id",
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectRoomsByAccountId).mockRejectedValue(new Error("Database error"));

      const request = createMockRequest(`http://localhost/api/chats?account_id=${accountId}`);
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.error).toBe("Database error");
    });
  });
});
