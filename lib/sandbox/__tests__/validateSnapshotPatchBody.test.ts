import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateSnapshotPatchBody } from "../validateSnapshotPatchBody";
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

describe("validateSnapshotPatchBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({ snapshotId: "snap_abc123" });
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = createMockRequest();
    const result = await validateSnapshotPatchBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns validated body when snapshotId is provided", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({ snapshotId: "snap_abc123" });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
    });

    const request = createMockRequest();
    const result = await validateSnapshotPatchBody(request);

    expect(result).toEqual({
      accountId: "acc_123",
      snapshotId: "snap_abc123",
    });
  });

  it("returns validated body when only github_repo is provided", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({
      github_repo: "https://github.com/org/repo",
    });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
    });

    const request = createMockRequest();
    const result = await validateSnapshotPatchBody(request);

    expect(result).toEqual({
      accountId: "acc_123",
      githubRepo: "https://github.com/org/repo",
    });
  });

  it("returns validated body when neither snapshotId nor github_repo is provided", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({});
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
    });

    const request = createMockRequest();
    const result = await validateSnapshotPatchBody(request);

    expect(result).toEqual({
      accountId: "acc_123",
    });
  });

  it("returns error response when snapshotId is empty string", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({ snapshotId: "" });

    const request = createMockRequest();
    const result = await validateSnapshotPatchBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("passes account_id to validateAuthContext when provided", async () => {
    const targetAccountId = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(safeParseJson).mockResolvedValue({
      snapshotId: "snap_abc123",
      account_id: targetAccountId,
    });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: targetAccountId,
      orgId: "org_789",
      authToken: "token",
    });

    const request = createMockRequest();
    const result = await validateSnapshotPatchBody(request);

    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: targetAccountId,
    });
    expect(result).toEqual({
      accountId: targetAccountId,
      snapshotId: "snap_abc123",
    });
  });

  it("returns 403 when account_id override is denied", async () => {
    const unauthorizedAccountId = "660e8400-e29b-41d4-a716-446655440001";
    vi.mocked(safeParseJson).mockResolvedValue({
      snapshotId: "snap_abc123",
      account_id: unauthorizedAccountId,
    });
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Access denied to specified account_id" }, { status: 403 }),
    );

    const request = createMockRequest();
    const result = await validateSnapshotPatchBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns validated body with github_repo when provided", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({
      snapshotId: "snap_abc123",
      github_repo: "https://github.com/org/repo",
    });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: "org_456",
      authToken: "token",
    });

    const request = createMockRequest();
    const result = await validateSnapshotPatchBody(request);

    expect(result).toEqual({
      accountId: "acc_123",
      snapshotId: "snap_abc123",
      githubRepo: "https://github.com/org/repo",
    });
  });

  it("returns error when account_id is not a valid UUID", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({
      snapshotId: "snap_abc123",
      account_id: "not-a-uuid",
    });

    const request = createMockRequest();
    const result = await validateSnapshotPatchBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const json = await (result as NextResponse).json();
    expect(json.error).toContain("account_id");
  });
});
