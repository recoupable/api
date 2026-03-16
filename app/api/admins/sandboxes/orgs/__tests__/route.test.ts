import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetAdminSandboxOrgsHandler = vi.fn();
vi.mock("@/lib/admins/sandboxes/getAdminSandboxOrgsHandler", () => ({
  getAdminSandboxOrgsHandler: (...args: unknown[]) =>
    mockGetAdminSandboxOrgsHandler(...args),
}));

const { GET, OPTIONS } = await import("../route");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admins/sandboxes/orgs", () => {
  it("delegates to getAdminSandboxOrgsHandler and returns its response", async () => {
    const expected = NextResponse.json(
      { status: "success", repos: [] },
      { status: 200 },
    );
    mockGetAdminSandboxOrgsHandler.mockResolvedValue(expected);

    const request = new NextRequest("https://example.com/api/admins/sandboxes/orgs");
    const response = await GET(request);

    expect(mockGetAdminSandboxOrgsHandler).toHaveBeenCalledWith(request);
    expect(response).toBe(expected);
  });

  it("returns 200 with repos when handler returns success", async () => {
    const repos = [
      {
        repo_name: "chat",
        repo_url: "https://github.com/recoupable/chat",
        total_commits: 42,
        latest_commit_messages: ["fix: auth bug", "feat: dashboard"],
        earliest_committed_at: "2024-01-15T10:00:00Z",
        latest_committed_at: "2026-03-16T09:00:00Z",
        account_repo_count: 2,
      },
    ];
    mockGetAdminSandboxOrgsHandler.mockResolvedValue(
      NextResponse.json({ status: "success", repos }, { status: 200 }),
    );

    const request = new NextRequest("https://example.com/api/admins/sandboxes/orgs");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.repos).toEqual(repos);
  });

  it("returns 200 with empty repos array", async () => {
    mockGetAdminSandboxOrgsHandler.mockResolvedValue(
      NextResponse.json({ status: "success", repos: [] }, { status: 200 }),
    );

    const request = new NextRequest("https://example.com/api/admins/sandboxes/orgs");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.repos).toEqual([]);
  });

  it("returns 401 when handler returns unauthorized", async () => {
    mockGetAdminSandboxOrgsHandler.mockResolvedValue(
      NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("https://example.com/api/admins/sandboxes/orgs");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when handler returns forbidden", async () => {
    mockGetAdminSandboxOrgsHandler.mockResolvedValue(
      NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 }),
    );

    const request = new NextRequest("https://example.com/api/admins/sandboxes/orgs");
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("returns 500 when handler returns internal error", async () => {
    mockGetAdminSandboxOrgsHandler.mockResolvedValue(
      NextResponse.json(
        { status: "error", message: "Internal server error" },
        { status: 500 },
      ),
    );

    const request = new NextRequest("https://example.com/api/admins/sandboxes/orgs");
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});

describe("OPTIONS /api/admins/sandboxes/orgs", () => {
  it("returns 200 for CORS preflight", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(200);
  });
});
