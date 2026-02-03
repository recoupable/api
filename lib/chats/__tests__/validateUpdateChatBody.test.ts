import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateUpdateChatBody } from "../validateUpdateChatBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("validateUpdateChatBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: object) => {
    return new NextRequest("http://localhost/api/chats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  describe("successful validation", () => {
    it("returns validated body when chatId and topic are valid", async () => {
      const chatId = "123e4567-e89b-12d3-a456-426614174000";
      const topic = "Valid Topic";
      const request = createRequest({ chatId, topic });

      const result = await validateUpdateChatBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ chatId, topic });
    });

    it("accepts topic at minimum length (3 chars)", async () => {
      const chatId = "123e4567-e89b-12d3-a456-426614174000";
      const topic = "abc";
      const request = createRequest({ chatId, topic });

      const result = await validateUpdateChatBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ chatId, topic });
    });

    it("accepts topic at maximum length (50 chars)", async () => {
      const chatId = "123e4567-e89b-12d3-a456-426614174000";
      const topic = "a".repeat(50);
      const request = createRequest({ chatId, topic });

      const result = await validateUpdateChatBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ chatId, topic });
    });
  });

  describe("validation errors", () => {
    it("returns 400 when chatId is missing", async () => {
      const request = createRequest({ topic: "Valid Topic" });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.status).toBe("error");
    });

    it("returns 400 when chatId is not a valid UUID", async () => {
      const request = createRequest({ chatId: "not-a-uuid", topic: "Valid Topic" });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("UUID");
    });

    it("returns 400 when topic is missing", async () => {
      const request = createRequest({ chatId: "123e4567-e89b-12d3-a456-426614174000" });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });

    it("returns 400 when topic is too short", async () => {
      const request = createRequest({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        topic: "ab",
      });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("3 and 50");
    });

    it("returns 400 when topic is too long", async () => {
      const request = createRequest({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        topic: "a".repeat(51),
      });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("3 and 50");
    });
  });

  describe("JSON parsing", () => {
    it("handles invalid JSON gracefully", async () => {
      const request = new NextRequest("http://localhost/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });

    it("handles empty body gracefully", async () => {
      const request = new NextRequest("http://localhost/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });
  });
});
