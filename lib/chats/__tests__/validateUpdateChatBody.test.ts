import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateUpdateChatBody } from "../validateUpdateChatBody";
import { validateChatAccess } from "../validateChatAccess";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateChatAccess", () => ({
  validateChatAccess: vi.fn(),
}));

describe("validateUpdateChatBody", () => {
  const chatId = "123e4567-e89b-12d3-a456-426614174000";

  const createRequest = (body: object | string) =>
    new NextRequest("http://localhost/api/chats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated data when access check passes", async () => {
    const topic = "Valid Topic";
    vi.mocked(validateChatAccess).mockResolvedValue({ roomId: chatId });

    const result = await validateUpdateChatBody(createRequest({ chatId, topic }));
    expect(result).toEqual({ chatId, topic });
    expect(validateChatAccess).toHaveBeenCalledWith(expect.any(NextRequest), chatId);
  });

  it("accepts topic at minimum length (3 chars)", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue({ roomId: chatId });
    const result = await validateUpdateChatBody(createRequest({ chatId, topic: "abc" }));
    expect(result).toEqual({ chatId, topic: "abc" });
  });

  it("accepts topic at maximum length (50 chars)", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue({ roomId: chatId });
    const topic = "a".repeat(50);
    const result = await validateUpdateChatBody(createRequest({ chatId, topic }));
    expect(result).toEqual({ chatId, topic });
  });

  it("returns 400 when chatId is missing", async () => {
    const result = await validateUpdateChatBody(createRequest({ topic: "Valid Topic" }));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("returns 400 when topic is too short", async () => {
    const result = await validateUpdateChatBody(createRequest({ chatId, topic: "ab" }));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("returns 400 when topic is too long", async () => {
    const result = await validateUpdateChatBody(createRequest({ chatId, topic: "a".repeat(51) }));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("returns access response when access check fails", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Access denied" }, { status: 403 }),
    );

    const result = await validateUpdateChatBody(createRequest({ chatId, topic: "Valid Topic" }));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("returns 400 on invalid JSON body", async () => {
    const result = await validateUpdateChatBody(createRequest("{invalid-json"));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });
});
