import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getChatsHandler } from "../getChatsHandler";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectChatsWithSessions } from "@/lib/supabase/chats/selectChatsWithSessions";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/chats/selectChatsWithSessions", () => ({
  selectChatsWithSessions: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-org-id",
}));

/**
 * Creates a mock NextRequest with the given URL and headers.
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
      expect(selectChatsWithSessions).not.toHaveBeenCalled();
    });
  });

  describe("personal key behavior", () => {
    it("returns chats projected to the new shape for personal key", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectChatsWithSessions).mockResolvedValue([
        {
          id: "chat-1",
          title: "Hello",
          session_id: "sess-1",
          updated_at: "2024-01-02T00:00:00Z",
          created_at: "2024-01-01T00:00:00Z",
          active_stream_id: null,
          last_assistant_message_at: null,
          model_id: null,
          session: { id: "sess-1", account_id: accountId },
        },
      ]);

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.chats).toEqual([
        {
          id: "chat-1",
          title: "Hello",
          accountId,
          sessionId: "sess-1",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ]);
      expect(selectChatsWithSessions).toHaveBeenCalledWith({ accountIds: [accountId] });
    });

    it("returns 403 when personal key tries to filter by account_id", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const otherAccountId = "223e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(canAccessAccount).mockResolvedValue(false);

      const request = createMockRequest(`http://localhost/api/chats?account_id=${otherAccountId}`);
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.status).toBe("error");
      expect(selectChatsWithSessions).not.toHaveBeenCalled();
    });
  });

  describe("backwards compat", () => {
    it("accepts artist_account_id but does not filter on it", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const artistId = "223e4567-e89b-12d3-a456-426614174001";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectChatsWithSessions).mockResolvedValue([]);

      const request = createMockRequest(`http://localhost/api/chats?artist_account_id=${artistId}`);
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(selectChatsWithSessions).toHaveBeenCalledWith({ accountIds: [accountId] });
    });
  });

  describe("admin behavior", () => {
    it("passes undefined accountIds for Recoup admin (no target filter)", async () => {
      const recoupOrgId = "recoup-org-id";
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: recoupOrgId,
        orgId: recoupOrgId,
        authToken: "test-token",
      });
      vi.mocked(selectChatsWithSessions).mockResolvedValue([]);

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);

      expect(response.status).toBe(200);
      expect(selectChatsWithSessions).toHaveBeenCalledWith({ accountIds: undefined });
    });

    it("scopes admin to the target account when account_id is provided", async () => {
      const recoupOrgId = "recoup-org-id";
      const target = "323e4567-e89b-12d3-a456-426614174000";
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: recoupOrgId,
        orgId: recoupOrgId,
        authToken: "test-token",
      });
      vi.mocked(canAccessAccount).mockResolvedValue(true);
      vi.mocked(selectChatsWithSessions).mockResolvedValue([]);

      const request = createMockRequest(`http://localhost/api/chats?account_id=${target}`);
      const response = await getChatsHandler(request);

      expect(response.status).toBe(200);
      expect(selectChatsWithSessions).toHaveBeenCalledWith({ accountIds: [target] });
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
      expect(selectChatsWithSessions).not.toHaveBeenCalled();
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
      expect(selectChatsWithSessions).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns 500 when selectChatsWithSessions returns null", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectChatsWithSessions).mockResolvedValue(null);

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
      vi.mocked(selectChatsWithSessions).mockRejectedValue(new Error("Database error"));

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.status).toBe("error");
      expect(json.error).toBe("Database error");
    });
  });

  describe("response projection", () => {
    it("skips rows whose session embed is missing", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-token",
      });
      vi.mocked(selectChatsWithSessions).mockResolvedValue([
        {
          id: "chat-keep",
          title: "Keep",
          session_id: "sess-1",
          updated_at: "2024-01-02T00:00:00Z",
          created_at: "2024-01-01T00:00:00Z",
          active_stream_id: null,
          last_assistant_message_at: null,
          model_id: null,
          session: { id: "sess-1", account_id: accountId },
        },
        {
          id: "chat-orphan",
          title: "Orphan",
          session_id: "sess-2",
          updated_at: "2024-01-03T00:00:00Z",
          created_at: "2024-01-01T00:00:00Z",
          active_stream_id: null,
          last_assistant_message_at: null,
          model_id: null,
          session: null,
        },
      ]);

      const request = createMockRequest("http://localhost/api/chats");
      const response = await getChatsHandler(request);
      const json = await response.json();

      expect(json.chats).toEqual([
        {
          id: "chat-keep",
          title: "Keep",
          accountId,
          sessionId: "sess-1",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ]);
    });
  });
});
