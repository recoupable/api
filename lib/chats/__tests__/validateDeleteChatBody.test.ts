import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateDeleteChatBody } from "../validateDeleteChatBody";
import { validateChatAccess } from "../validateChatAccess";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateChatAccess", () => ({
  validateChatAccess: vi.fn(),
}));

describe("validateDeleteChatBody", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";

  const createRequest = (body: object | string) =>
    new NextRequest("http://localhost/api/chats", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated id when access check passes", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue({ roomId: id });

    const result = await validateDeleteChatBody(createRequest({ id }));
    expect(result).toEqual({ id });
    expect(validateChatAccess).toHaveBeenCalledWith(expect.any(NextRequest), id);
  });

  it("returns 400 when id is missing", async () => {
    const result = await validateDeleteChatBody(createRequest({}));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("returns 400 when id is invalid UUID", async () => {
    const result = await validateDeleteChatBody(createRequest({ id: "invalid" }));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("returns access response when access check fails", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateDeleteChatBody(createRequest({ id }));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid JSON body", async () => {
    const result = await validateDeleteChatBody(createRequest("{invalid-json"));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });
});
