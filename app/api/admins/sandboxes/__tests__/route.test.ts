import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetAdminSandboxesHandler = vi.fn();
vi.mock("@/lib/admins/sandboxes/getAdminSandboxesHandler", () => ({
  getAdminSandboxesHandler: (...args: unknown[]) =>
    mockGetAdminSandboxesHandler(...args),
}));

const { GET, OPTIONS } = await import("../route");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admins/sandboxes", () => {
  it("delegates to getAdminSandboxesHandler and returns its response", async () => {
    const expected = NextResponse.json(
      { status: "success", accounts: [] },
      { status: 200 },
    );
    mockGetAdminSandboxesHandler.mockResolvedValue(expected);

    const request = new NextRequest("https://example.com/api/admins/sandboxes");
    const response = await GET(request);

    expect(mockGetAdminSandboxesHandler).toHaveBeenCalledWith(request);
    expect(response).toBe(expected);
  });

  it("returns 200 with accounts when handler returns success", async () => {
    const accounts = [
      {
        account_id: "acc-1",
        account_name: "Alice",
        total_sandboxes: 3,
        last_created_at: "2026-03-10T12:00:00Z",
      },
    ];
    mockGetAdminSandboxesHandler.mockResolvedValue(
      NextResponse.json({ status: "success", accounts }, { status: 200 }),
    );

    const request = new NextRequest("https://example.com/api/admins/sandboxes");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accounts).toEqual(accounts);
  });

  it("returns 200 with empty accounts array", async () => {
    mockGetAdminSandboxesHandler.mockResolvedValue(
      NextResponse.json({ status: "success", accounts: [] }, { status: 200 }),
    );

    const request = new NextRequest("https://example.com/api/admins/sandboxes");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accounts).toEqual([]);
  });

  it("returns 401 when handler returns unauthorized", async () => {
    mockGetAdminSandboxesHandler.mockResolvedValue(
      NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("https://example.com/api/admins/sandboxes");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when handler returns forbidden", async () => {
    mockGetAdminSandboxesHandler.mockResolvedValue(
      NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 }),
    );

    const request = new NextRequest("https://example.com/api/admins/sandboxes");
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("returns 500 when handler returns internal error", async () => {
    mockGetAdminSandboxesHandler.mockResolvedValue(
      NextResponse.json(
        { status: "error", message: "Internal server error" },
        { status: 500 },
      ),
    );

    const request = new NextRequest("https://example.com/api/admins/sandboxes");
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});

describe("OPTIONS /api/admins/sandboxes", () => {
  it("returns 200 for CORS preflight", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(200);
  });
});
