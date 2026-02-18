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
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns validated body with auth context when command is provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({ command: "ls" });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toEqual({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
      command: "ls",
    });
  });

  it("returns validated body with optional args and cwd", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({
      command: "ls",
      args: ["-la", "/home"],
      cwd: "/tmp",
    });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toEqual({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
      command: "ls",
      args: ["-la", "/home"],
      cwd: "/tmp",
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

  it("returns error response when both command and prompt are provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({
      command: "ls",
      prompt: "do something",
    });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns error response when prompt is empty string", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({ prompt: "" });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns error response when command is empty string", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({ command: "" });

    const request = createMockRequest();
    const result = await validateSandboxBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
