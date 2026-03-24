import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

import { uploadSandboxFilesHandler } from "../uploadSandboxFilesHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { resolveSubmodulePath } from "@/lib/github/resolveSubmodulePath";
import { commitFileToRepo } from "@/lib/github/commitFileToRepo";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

vi.mock("@/lib/github/resolveSubmodulePath", () => ({
  resolveSubmodulePath: vi.fn(),
}));

vi.mock("@/lib/github/commitFileToRepo", () => ({
  commitFileToRepo: vi.fn(),
}));

const mockAccountId = "550e8400-e29b-41d4-a716-446655440000";
const mockGithubRepo = "https://github.com/testorg/test-repo";
const mockFolder = ".openclaw/workspace/orgs/myorg";

/**
 *
 * @param files
 * @param folder
 */
function createMockFormData(files: { name: string; content: string }[], folder: string) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", new Blob([file.content], { type: "text/plain" }), file.name);
  }
  formData.append("folder", folder);
  return formData;
}

/**
 *
 * @param formData
 */
function createMockRequest(formData?: FormData) {
  if (!formData) {
    formData = createMockFormData([{ name: "test.txt", content: "hello" }], mockFolder);
  }
  return new Request("https://example.com/api/sandboxes/files", {
    method: "POST",
    body: formData,
  });
}

describe("uploadSandboxFilesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when auth fails", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest();
      const response = await uploadSandboxFilesHandler(request as never);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("validation", () => {
    it("returns 400 when folder is missing", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: mockAccountId,
        orgId: null,
        authToken: "token",
      });

      const formData = new FormData();
      formData.append("files", new Blob(["hello"], { type: "text/plain" }), "test.txt");
      // no folder field

      const request = createMockRequest(formData);
      const response = await uploadSandboxFilesHandler(request as never);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("folder");
    });

    it("returns 400 when no files are provided", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: mockAccountId,
        orgId: null,
        authToken: "token",
      });

      const formData = new FormData();
      formData.append("folder", mockFolder);

      const request = createMockRequest(formData);
      const response = await uploadSandboxFilesHandler(request as never);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("file");
    });
  });

  describe("snapshot lookup", () => {
    it("returns 404 when no GitHub repo is found", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: mockAccountId,
        orgId: null,
        authToken: "token",
      });
      vi.mocked(selectAccountSnapshots).mockResolvedValue([]);

      const request = createMockRequest();
      const response = await uploadSandboxFilesHandler(request as never);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("GitHub repository");
    });
  });

  describe("successful upload", () => {
    it("commits files to the resolved submodule repo", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: mockAccountId,
        orgId: null,
        authToken: "token",
      });
      vi.mocked(selectAccountSnapshots).mockResolvedValue([
        { github_repo: mockGithubRepo } as never,
      ]);
      vi.mocked(resolveSubmodulePath).mockResolvedValue({
        githubRepo: "https://github.com/testorg/myorg-repo",
        path: "test.txt",
      });
      vi.mocked(commitFileToRepo).mockResolvedValue({ path: "test.txt", success: true });

      const request = createMockRequest();
      const response = await uploadSandboxFilesHandler(request as never);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("success");
      expect(data.uploaded).toHaveLength(1);
      expect(data.uploaded[0].success).toBe(true);
    });

    it("returns per-file results including errors", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: mockAccountId,
        orgId: null,
        authToken: "token",
      });
      vi.mocked(selectAccountSnapshots).mockResolvedValue([
        { github_repo: mockGithubRepo } as never,
      ]);
      vi.mocked(resolveSubmodulePath).mockResolvedValue({
        githubRepo: mockGithubRepo,
        path: "test.txt",
      });
      vi.mocked(commitFileToRepo).mockResolvedValue({
        path: "test.txt",
        success: false,
        error: "Permission denied",
      });

      const request = createMockRequest();
      const response = await uploadSandboxFilesHandler(request as never);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.uploaded[0].success).toBe(false);
      expect(data.uploaded[0].error).toBe("Permission denied");
    });
  });
});
