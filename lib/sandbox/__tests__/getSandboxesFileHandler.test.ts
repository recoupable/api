import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSandboxesFileHandler } from "../getSandboxesFileHandler";
import { validateGetSandboxesFileRequest } from "../validateGetSandboxesFileRequest";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { getRawFileContent } from "@/lib/github/getRawFileContent";
import { getRawFileContentBase64 } from "@/lib/github/getRawFileContentBase64";
import { resolveSubmodulePath } from "@/lib/github/resolveSubmodulePath";

vi.mock("../validateGetSandboxesFileRequest", () => ({
  validateGetSandboxesFileRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

vi.mock("@/lib/github/getRawFileContent", () => ({
  getRawFileContent: vi.fn(),
}));

vi.mock("@/lib/github/getRawFileContentBase64", () => ({
  getRawFileContentBase64: vi.fn(),
}));

vi.mock("@/lib/github/resolveSubmodulePath", () => ({
  resolveSubmodulePath: vi.fn(),
}));

/**
 * Creates a mock NextRequest for testing.
 *
 * @param path - The file path query parameter
 * @param format - Optional format query parameter (e.g. "base64")
 * @returns A mock NextRequest object
 */
function createMockRequest(path = "src/index.ts", format?: string): NextRequest {
  const params = new URLSearchParams({ path });
  if (format) params.set("format", format);
  const url = `http://localhost:3000/api/sandboxes/file?${params.toString()}`;
  return {
    url,
    nextUrl: new URL(url),
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("getSandboxesFileHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: resolveSubmodulePath passes through unchanged
    vi.mocked(resolveSubmodulePath).mockImplementation(async params => params);
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

  it("calls resolveSubmodulePath then getRawFileContent with resolved params", async () => {
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

    expect(resolveSubmodulePath).toHaveBeenCalledWith({
      githubRepo: "https://github.com/user/repo",
      path: "src/utils/helper.ts",
    });
    expect(getRawFileContent).toHaveBeenCalledWith({
      githubRepo: "https://github.com/user/repo",
      path: "src/utils/helper.ts",
    });
  });

  it("returns base64-encoded content when format=base64", async () => {
    vi.mocked(validateGetSandboxesFileRequest).mockResolvedValue({
      accountIds: ["acc_123"],
      path: "images/logo.png",
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
    vi.mocked(getRawFileContentBase64).mockResolvedValue({
      content: "iVBORw0KGgo=",
    });

    const request = createMockRequest("images/logo.png", "base64");
    const response = await getSandboxesFileHandler(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      status: "success",
      content: "iVBORw0KGgo=",
      encoding: "base64",
    });
    expect(getRawFileContentBase64).toHaveBeenCalledWith({
      githubRepo: "https://github.com/user/repo",
      path: "images/logo.png",
    });
    expect(getRawFileContent).not.toHaveBeenCalled();
  });

  it("fetches from submodule repo when path is inside a submodule", async () => {
    vi.mocked(validateGetSandboxesFileRequest).mockResolvedValue({
      accountIds: ["acc_123"],
      path: ".openclaw/workspace/orgs/my-org/artist.md",
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
    vi.mocked(resolveSubmodulePath).mockResolvedValue({
      githubRepo: "https://github.com/recoupable/org-my-org-abc123",
      path: "artist.md",
    });
    vi.mocked(getRawFileContent).mockResolvedValue({
      content: "# Artist Info",
    });

    const request = createMockRequest(".openclaw/workspace/orgs/my-org/artist.md");
    const response = await getSandboxesFileHandler(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.content).toBe("# Artist Info");
    expect(getRawFileContent).toHaveBeenCalledWith({
      githubRepo: "https://github.com/recoupable/org-my-org-abc123",
      path: "artist.md",
    });
  });
});
