import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateSandboxBody } from "../validateSandboxBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

/**
 * Creates a mock NextRequest for testing.
 *
 * @returns A mock NextRequest object
 */
function createMockRequest(): NextRequest {
  return {
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("validateSandboxBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({});
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns validated body with auth context when prompt is provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({ prompt: "say hello" });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toEqual({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
      prompt: "say hello",
    });
  });

  it("strips unknown fields from body", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({
      prompt: "say hello",
      command: "ls",
      args: ["-la"],
      cwd: "/tmp",
    });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toEqual({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
      prompt: "say hello",
    });
  });

  it("returns validated body when command is omitted (optional)", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({});

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toEqual({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });
  });

  it("returns validated body when prompt is provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({
      prompt: "create a hello world index.html",
    });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toEqual({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
      prompt: "create a hello world index.html",
    });
  });

  it("returns error response when prompt is empty string", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({ prompt: "" });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("passes body account_id to validateAuthContext for override", async () => {
    const targetAccountId = "10000000-1000-4000-8000-100000000001";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: targetAccountId,
      orgId: "org_456",
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({
      account_id: targetAccountId,
      prompt: "hello",
    });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: targetAccountId,
    });
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as Record<string, unknown>).accountId).toBe(targetAccountId);
  });

  it("does not include account_id in returned body fields", async () => {
    const targetAccountId = "10000000-1000-4000-8000-100000000001";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: targetAccountId,
      orgId: "org_456",
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({
      account_id: targetAccountId,
      prompt: "hello",
    });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).not.toHaveProperty("account_id");
    expect(result).toEqual({
      accountId: targetAccountId,
      orgId: "org_456",
      authToken: "token",
      prompt: "hello",
    });
  });

  it("calls validateAuthContext without accountId when no account_id in body", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({});

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: undefined,
    });
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("returns 403 when validateAuthContext rejects account_id override", async () => {
    const targetAccountId = "20000000-2000-4000-8000-200000000002";
    vi.mocked(safeParseJson).mockResolvedValue({
      account_id: targetAccountId,
      prompt: "hello",
    });
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Access denied" }, { status: 403 }),
    );

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns 400 when account_id in body is not a valid UUID", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({ account_id: "not-a-uuid" });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
