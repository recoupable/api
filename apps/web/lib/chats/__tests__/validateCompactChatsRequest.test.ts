import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCompactChatsRequest } from "../validateCompactChatsRequest";

const mockValidateAuthContext = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Creates a mock NextRequest with a JSON body.
 *
 * @param body - The request body to mock.
 * @returns A mock NextRequest.
 */
function createMockRequest(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: {
      get: (name: string) => (name === "x-api-key" ? "test-api-key" : null),
    },
  } as unknown as NextRequest;
}

describe("validateCompactChatsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "account-123",
      orgId: "org-456",
      authToken: "test-token",
    });
  });

  describe("valid inputs", () => {
    it("accepts a single valid UUID in chatId array", async () => {
      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
      });

      const result = await validateCompactChatsRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        chatIds: ["123e4567-e89b-12d3-a456-426614174000"],
        prompt: undefined,
        accountId: "account-123",
        orgId: "org-456",
      });
    });

    it("accepts multiple valid UUIDs in chatId array", async () => {
      const request = createMockRequest({
        chatId: [
          "123e4567-e89b-12d3-a456-426614174000",
          "223e4567-e89b-12d3-a456-426614174001",
          "323e4567-e89b-12d3-a456-426614174002",
        ],
      });

      const result = await validateCompactChatsRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toHaveProperty("chatIds");
      const typedResult = result as { chatIds: string[] };
      expect(typedResult.chatIds).toHaveLength(3);
    });

    it("accepts optional prompt parameter", async () => {
      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
        prompt: "Focus on action items and decisions",
      });

      const result = await validateCompactChatsRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        chatIds: ["123e4567-e89b-12d3-a456-426614174000"],
        prompt: "Focus on action items and decisions",
        accountId: "account-123",
        orgId: "org-456",
      });
    });
  });

  describe("invalid inputs", () => {
    it("rejects missing chatId", async () => {
      const request = createMockRequest({});

      const result = await validateCompactChatsRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });

    it("rejects empty chatId array", async () => {
      const request = createMockRequest({
        chatId: [],
      });

      const result = await validateCompactChatsRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });

    it("rejects invalid UUID in chatId array", async () => {
      const request = createMockRequest({
        chatId: ["not-a-valid-uuid"],
      });

      const result = await validateCompactChatsRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });

    it("rejects chatId as a string instead of array", async () => {
      const request = createMockRequest({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
      });

      const result = await validateCompactChatsRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });

    it("rejects array with one invalid UUID among valid ones", async () => {
      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000", "invalid-uuid"],
      });

      const result = await validateCompactChatsRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });
  });

  describe("authentication", () => {
    it("returns auth error when validateAuthContext fails", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
      });

      const result = await validateCompactChatsRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(401);
    });

    it("includes accountId and orgId from auth context", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "my-account",
        orgId: "my-org",
        authToken: "test-token",
      });

      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
      });

      const result = await validateCompactChatsRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toMatchObject({
        accountId: "my-account",
        orgId: "my-org",
      });
    });

    it("handles undefined orgId from auth context", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "my-account",
        orgId: undefined,
        authToken: "test-token",
      });

      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
      });

      const result = await validateCompactChatsRequest(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toMatchObject({
        accountId: "my-account",
        orgId: undefined,
      });
    });
  });
});
