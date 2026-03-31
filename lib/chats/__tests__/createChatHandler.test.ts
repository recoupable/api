import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createChatHandler } from "../createChatHandler";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { upsertRoom } from "@/lib/supabase/rooms/upsertRoom";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { generateChatTitle } from "../generateChatTitle";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { sendNewConversationNotification } from "@/lib/telegram/sendNewConversationNotification";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/upsertRoom", () => ({
  upsertRoom: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/telegram/sendNewConversationNotification", () => ({
  sendNewConversationNotification: vi.fn(),
}));

vi.mock("@/lib/uuid/generateUUID", () => ({
  generateUUID: vi.fn(() => "generated-uuid-123"),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

vi.mock("../generateChatTitle", () => ({
  generateChatTitle: vi.fn(),
}));

/**
 * Creates a mock NextRequest with normalized headers for testing.
 *
 * @param headers - Key-value map of request headers to include
 * @returns A partial NextRequest mock with a working headers.get method
 */
function createMockRequest(
  headers: Record<string, string> = { "x-api-key": "test-api-key" },
): NextRequest {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    headers: {
      get: (name: string) => normalized[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe("createChatHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectAccountEmails).mockResolvedValue([]);
  });

  describe("without accountId override", () => {
    it("uses the authenticated accountId when no accountId is in the body", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174111";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-api-key",
      });
      vi.mocked(safeParseJson).mockResolvedValue({ artistId });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: null,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(validateAuthContext).toHaveBeenCalledWith(request, {
        accountId: undefined,
      });
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: null,
      });
      expect(sendNewConversationNotification).toHaveBeenCalledWith({
        accountId,
        email: "",
        conversationId: "generated-uuid-123",
        topic: "",
        firstMessage: undefined,
      });
    });
  });

  describe("with accountId override", () => {
    it("uses body accountId when auth validation succeeds", async () => {
      const authenticatedAccountId = "123e4567-e89b-12d3-a456-426614174009";
      const targetAccountId = "123e4567-e89b-12d3-a456-426614174001";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        accountId: targetAccountId,
      });
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: targetAccountId,
        orgId: authenticatedAccountId,
        authToken: "test-api-key",
      });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: targetAccountId,
        artist_id: artistId,
        topic: null,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(validateAuthContext).toHaveBeenCalledWith(request, {
        accountId: targetAccountId,
      });
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: targetAccountId,
        artist_id: artistId,
        topic: null,
      });
      expect(sendNewConversationNotification).toHaveBeenCalledWith({
        accountId: targetAccountId,
        email: "",
        conversationId: "generated-uuid-123",
        topic: "",
        firstMessage: undefined,
      });
    });

    it("returns auth validation errors unchanged", async () => {
      const targetAccountId = "123e4567-e89b-12d3-a456-426614174001";

      vi.mocked(safeParseJson).mockResolvedValue({
        accountId: targetAccountId,
      });
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Access denied to specified account_id" },
          { status: 403 },
        ),
      );

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.status).toBe("error");
      expect(json.error).toBe("Access denied to specified account_id");
      expect(upsertRoom).not.toHaveBeenCalled();
      expect(sendNewConversationNotification).not.toHaveBeenCalled();
    });
  });

  describe("with topic parameter", () => {
    it("uses provided topic directly without generating", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174111";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";
      const topic = "My Custom Topic";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-api-key",
      });
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        topic,
      });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(generateChatTitle).not.toHaveBeenCalled();
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic,
      });
      expect(sendNewConversationNotification).toHaveBeenCalledWith({
        accountId,
        email: "",
        conversationId: "generated-uuid-123",
        topic,
        firstMessage: undefined,
      });
    });

    it("uses provided topic even when firstMessage is also provided", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174111";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";
      const topic = "My Custom Topic";
      const firstMessage = "What marketing strategies should I use?";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-api-key",
      });
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        topic,
        firstMessage,
      });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(generateChatTitle).not.toHaveBeenCalled();
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic,
      });
      expect(sendNewConversationNotification).toHaveBeenCalledWith({
        accountId,
        email: "",
        conversationId: "generated-uuid-123",
        topic,
        firstMessage,
      });
    });
  });

  describe("with firstMessage (title generation)", () => {
    it("generates a title from firstMessage when provided", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174111";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";
      const firstMessage = "What marketing strategies should I use?";
      const generatedTitle = "Marketing Plan";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-api-key",
      });
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        firstMessage,
      });
      vi.mocked(generateChatTitle).mockResolvedValue(generatedTitle);
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: generatedTitle,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(generateChatTitle).toHaveBeenCalledWith(firstMessage);
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: generatedTitle,
      });
      expect(sendNewConversationNotification).toHaveBeenCalledWith({
        accountId,
        email: "",
        conversationId: "generated-uuid-123",
        topic: generatedTitle,
        firstMessage,
      });
    });

    it("uses null topic when firstMessage is not provided", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174111";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-api-key",
      });
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
      });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: null,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);

      expect(response.status).toBe(200);
      expect(generateChatTitle).not.toHaveBeenCalled();
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: null,
      });
      expect(sendNewConversationNotification).toHaveBeenCalledWith({
        accountId,
        email: "",
        conversationId: "generated-uuid-123",
        topic: "",
        firstMessage: undefined,
      });
    });

    it("handles title generation failure gracefully", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174111";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";
      const firstMessage = "What marketing strategies should I use?";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-api-key",
      });
      vi.mocked(safeParseJson).mockResolvedValue({
        artistId,
        firstMessage,
      });
      vi.mocked(generateChatTitle).mockRejectedValue(new Error("AI generation failed"));
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: null,
      });

      const request = createMockRequest();
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(generateChatTitle).toHaveBeenCalledWith(firstMessage);
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: null,
      });
      expect(sendNewConversationNotification).toHaveBeenCalledWith({
        accountId,
        email: "",
        conversationId: "generated-uuid-123",
        topic: "",
        firstMessage,
      });
    });
  });

  describe("with bearer authentication", () => {
    it("creates a chat when authenticated via Authorization bearer token", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174222";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "bearer-token-123",
      });
      vi.mocked(safeParseJson).mockResolvedValue({ artistId });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: null,
      });

      const request = createMockRequest({
        authorization: "Bearer bearer-token-123",
      });
      const response = await createChatHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(validateAuthContext).toHaveBeenCalledWith(request, {
        accountId: undefined,
      });
      expect(upsertRoom).toHaveBeenCalledWith({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: null,
      });
      expect(sendNewConversationNotification).toHaveBeenCalledWith({
        accountId,
        email: "",
        conversationId: "generated-uuid-123",
        topic: "",
        firstMessage: undefined,
      });
    });
  });

  describe("notification email lookup", () => {
    it("uses the first account email when sending telegram notifications", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174333";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "bearer-token-123",
      });
      vi.mocked(safeParseJson).mockResolvedValue({ artistId });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: null,
      });
      vi.mocked(selectAccountEmails).mockResolvedValue([
        { email: "first@example.com" } as never,
        { email: "second@example.com" } as never,
      ]);

      const request = createMockRequest({
        authorization: "Bearer bearer-token-123",
      });
      await createChatHandler(request);

      expect(selectAccountEmails).toHaveBeenCalledWith({
        accountIds: accountId,
      });
      expect(sendNewConversationNotification).toHaveBeenCalledWith({
        accountId,
        email: "first@example.com",
        conversationId: "generated-uuid-123",
        topic: "",
        firstMessage: undefined,
      });
    });

    it("does not fail chat creation when notification sending throws", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174444";
      const artistId = "123e4567-e89b-12d3-a456-426614174000";

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "bearer-token-123",
      });
      vi.mocked(safeParseJson).mockResolvedValue({ artistId });
      vi.mocked(upsertRoom).mockResolvedValue({
        id: "generated-uuid-123",
        account_id: accountId,
        artist_id: artistId,
        topic: null,
      });
      vi.mocked(sendNewConversationNotification).mockRejectedValue(new Error("telegram failed"));

      const request = createMockRequest({
        authorization: "Bearer bearer-token-123",
      });
      const response = await createChatHandler(request);

      expect(response.status).toBe(200);
      expect(upsertRoom).toHaveBeenCalled();
    });
  });
});
