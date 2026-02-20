import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSandboxesFileHandler } from "../getSandboxesFileHandler";
import { validateGetSandboxesFileRequest } from "../validateGetSandboxesFileRequest";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { getRawFileContent } from "@/lib/github/getRawFileContent";

vi.mock("../validateGetSandboxesFileRequest", () => ({
  validateGetSandboxesFileRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

vi.mock("@/lib/github/getRawFileContent", () => ({
  getRawFileContent: vi.fn(),
}));

/**
 * Creates a mock NextRequest for testing.
 *
 * @param path - The file path query parameter
 * @returns A mock NextRequest object
 */
function createMockRequest(path = "src/index.ts"): NextRequest {
  return {
    url: `http://localhost:3000/api/sandboxes/file?path=${encodeURIComponent(path)}`,
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("getSandboxesFileHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error response when validation fails", async () => {
    vi.mocked(validateGetSandboxesFileRequest).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = createMockRequest();
    const response = await getSandboxesFileHandler(request);

    expect(response.status).toBe(401);
  });

  it("returns 200 with content on success", async () => {
    vi.mocked(validateGetSandboxesFileRequest).mockResolvedValue({
      accountIds: ["acc_123"],
      path: "src/index.ts",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        account_id: "acc_123",
        snapshot_id: "snap_abc",
        github_repo: "https://github.com/user/repo",
        created_at: "2024-01-01T00:00:00.000Z",
        expires_at: "2024-01-08T00:00:00.000Z",
      },
    ]);
    vi.mocked(getRawFileContent).mockResolvedValue({
      content: "console.log('hello');",
    });

    const request = createMockRequest();
    const response = await getSandboxesFileHandler(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      status: "success",
      content: "console.log('hello');",
    });
  });

  it("returns 404 when no snapshot/github_repo found", async () => {
    vi.mocked(validateGetSandboxesFileRequest).mockResolvedValue({
      accountIds: ["acc_123"],
      path: "src/index.ts",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);

    const request = createMockRequest();
    const response = await getSandboxesFileHandler(request);

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("No GitHub repository found for this account");
  });

  it("returns 404 when snapshot exists but github_repo is null", async () => {
    vi.mocked(validateGetSandboxesFileRequest).mockResolvedValue({
      accountIds: ["acc_123"],
      path: "src/index.ts",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        account_id: "acc_123",
        snapshot_id: "snap_abc",
        github_repo: null,
        created_at: "2024-01-01T00:00:00.000Z",
        expires_at: "2024-01-08T00:00:00.000Z",
      },
    ]);

    const request = createMockRequest();
    const response = await getSandboxesFileHandler(request);

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("No GitHub repository found for this account");
  });

  it("returns 404 when file not found on GitHub", async () => {
    vi.mocked(validateGetSandboxesFileRequest).mockResolvedValue({
      accountIds: ["acc_123"],
      path: "nonexistent.ts",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        account_id: "acc_123",
        snapshot_id: "snap_abc",
        github_repo: "https://github.com/user/repo",
        created_at: "2024-01-01T00:00:00.000Z",
        expires_at: "2024-01-08T00:00:00.000Z",
      },
    ]);
    vi.mocked(getRawFileContent).mockResolvedValue({
      error: "File not found in repository",
    });

    const request = createMockRequest();
    const response = await getSandboxesFileHandler(request);

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("File not found in repository");
  });

  it("uses orgId for snapshot lookup when multiple accountIds", async () => {
    vi.mocked(validateGetSandboxesFileRequest).mockResolvedValue({
      accountIds: ["acc_1", "acc_2"],
      orgId: "org_123",
      path: "README.md",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        account_id: "org_123",
        snapshot_id: "snap_org",
        github_repo: "https://github.com/org/repo",
        created_at: "2024-01-01T00:00:00.000Z",
        expires_at: "2024-01-08T00:00:00.000Z",
      },
    ]);
    vi.mocked(getRawFileContent).mockResolvedValue({
      content: "# README",
    });

    const request = createMockRequest("README.md");
    const response = await getSandboxesFileHandler(request);

    expect(response.status).toBe(200);
    expect(selectAccountSnapshots).toHaveBeenCalledWith("org_123");
  });

  it("calls getRawFileContent with correct params", async () => {
    vi.mocked(validateGetSandboxesFileRequest).mockResolvedValue({
      accountIds: ["acc_123"],
      path: "src/utils/helper.ts",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        account_id: "acc_123",
        snapshot_id: "snap_abc",
        github_repo: "https://github.com/user/repo",
        created_at: "2024-01-01T00:00:00.000Z",
        expires_at: "2024-01-08T00:00:00.000Z",
      },
    ]);
    vi.mocked(getRawFileContent).mockResolvedValue({
      content: "export function helper() {}",
    });

    const request = createMockRequest("src/utils/helper.ts");
    await getSandboxesFileHandler(request);

    expect(getRawFileContent).toHaveBeenCalledWith({
      githubRepo: "https://github.com/user/repo",
      path: "src/utils/helper.ts",
    });
  });
});
