import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateDeleteChatBody } from "../validateDeleteChatBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { buildGetChatsParams } from "@/lib/chats/buildGetChatsParams";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/chats/buildGetChatsParams", () => ({
  buildGetChatsParams: vi.fn(),
}));

describe("validateDeleteChatBody", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const accountId = "123e4567-e89b-12d3-a456-426614174001";

  const createRequest = (body: object | string) =>
    new NextRequest("http://localhost/api/chats", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated id when caller has access", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-key",
    });
    vi.mocked(selectRoom).mockResolvedValue({
      id,
      account_id: accountId,
      artist_id: null,
      topic: "Topic",
      updated_at: "2026-03-30T00:00:00Z",
    });
    vi.mocked(buildGetChatsParams).mockResolvedValue({
      params: { account_ids: [accountId] },
      error: null,
    });

    const result = await validateDeleteChatBody(createRequest({ id }));
    expect(result).toEqual({ id });
  });

  it("allows admin access when account_ids is undefined", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: "admin-org",
      authToken: "admin-key",
    });
    vi.mocked(selectRoom).mockResolvedValue({
      id,
      account_id: "another-account",
      artist_id: null,
      topic: "Topic",
      updated_at: "2026-03-30T00:00:00Z",
    });
    vi.mocked(buildGetChatsParams).mockResolvedValue({
      params: {},
      error: null,
    });

    const result = await validateDeleteChatBody(createRequest({ id }));
    expect(result).toEqual({ id });
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

  it("returns auth response when authentication fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateDeleteChatBody(createRequest({ id }));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("returns 404 when chat is not found", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-key",
    });
    vi.mocked(selectRoom).mockResolvedValue(null);

    const result = await validateDeleteChatBody(createRequest({ id }));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(404);
  });

  it("returns 403 when account cannot access chat", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-key",
    });
    vi.mocked(selectRoom).mockResolvedValue({
      id,
      account_id: "another-account",
      artist_id: null,
      topic: "Topic",
      updated_at: "2026-03-30T00:00:00Z",
    });
    vi.mocked(buildGetChatsParams).mockResolvedValue({
      params: { account_ids: [accountId] },
      error: null,
    });

    const result = await validateDeleteChatBody(createRequest({ id }));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("returns 400 on invalid JSON body", async () => {
    const result = await validateDeleteChatBody(createRequest("{invalid-json"));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });
});
