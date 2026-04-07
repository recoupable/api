import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateUpdateAccountRequest } from "../validateUpdateAccountRequest";

const mockValidateAuthContext = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(async (req: Request) => req.json()),
}));

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/accounts", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

describe("validateUpdateAccountRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      orgId: null,
      authToken: "test-token",
    });
  });

  it("returns validated payload for a valid request", async () => {
    const request = createRequest({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test User",
      knowledges: [
        {
          name: "Strategy",
          url: "https://example.com/strategy.pdf",
          type: "application/pdf",
        },
      ],
    });

    const result = await validateUpdateAccountRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result).toEqual({
        accountId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test User",
        knowledges: [
          {
            name: "Strategy",
            url: "https://example.com/strategy.pdf",
            type: "application/pdf",
          },
        ],
      });
    }
    expect(mockValidateAuthContext).toHaveBeenCalledWith(request, {
      accountId: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("replaces accountId with the validated override account", async () => {
    mockValidateAuthContext.mockResolvedValue({
      accountId: "660e8400-e29b-41d4-a716-446655440001",
      orgId: "org-123",
      authToken: "test-token",
    });

    const request = createRequest({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Org Member",
    });

    const result = await validateUpdateAccountRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.accountId).toBe("660e8400-e29b-41d4-a716-446655440001");
    }
  });

  it("returns 400 when knowledges payload is invalid", async () => {
    const request = createRequest({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      knowledges: ["not-an-object"],
    });

    const result = await validateUpdateAccountRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("succeeds without accountId in body (derives from auth)", async () => {
    const request = createRequest({
      name: "Updated Name",
    });

    const result = await validateUpdateAccountRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.accountId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.name).toBe("Updated Name");
    }
  });

  it("returns 400 when no updatable fields are provided", async () => {
    const request = createRequest({});

    const result = await validateUpdateAccountRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("returns auth error response when auth fails", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = createRequest({
      name: "Test",
    });

    const result = await validateUpdateAccountRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401);
    }
  });
});
