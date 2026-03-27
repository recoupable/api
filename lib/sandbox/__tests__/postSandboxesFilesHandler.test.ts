import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { postSandboxesFilesHandler } from "../postSandboxesFilesHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validatePostSandboxesFilesRequest", () => ({
  validatePostSandboxesFilesRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

vi.mock("@/lib/github/resolveSubmodulePath", () => ({
  resolveSubmodulePath: vi.fn(),
}));

vi.mock("@/lib/github/createOrUpdateFileContent", () => ({
  createOrUpdateFileContent: vi.fn(),
}));

import { validatePostSandboxesFilesRequest } from "../validatePostSandboxesFilesRequest";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { resolveSubmodulePath } from "@/lib/github/resolveSubmodulePath";
import { createOrUpdateFileContent } from "@/lib/github/createOrUpdateFileContent";

describe("postSandboxesFilesHandler", () => {
  const mockRequest = new NextRequest("https://example.com/api/sandboxes/files", {
    method: "POST",
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation error when validation fails", async () => {
    const errorResponse = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue(errorResponse);

    const result = await postSandboxesFilesHandler(mockRequest);

    expect(result.status).toBe(401);
  });

  it("returns 404 when no accountIds resolved", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: [],
      path: "",
      message: "test",
      files: [{ name: "f.txt", content: Buffer.from("x") }],
    });

    const result = await postSandboxesFilesHandler(mockRequest);
    const body = await result.json();

    expect(result.status).toBe(404);
    expect(body.error).toBe("Could not determine account for snapshot lookup");
  });

  it("returns 404 when no GitHub repo found", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: ["acc-1"],
      path: "",
      message: "test",
      files: [{ name: "f.txt", content: Buffer.from("x") }],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);

    const result = await postSandboxesFilesHandler(mockRequest);
    const body = await result.json();

    expect(result.status).toBe(404);
    expect(body.error).toBe("No GitHub repository found for this account");
  });

  it("uploads a single file successfully", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: ["acc-1"],
      path: "docs",
      message: "Upload",
      files: [{ name: "readme.md", content: Buffer.from("# Hello") }],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      { github_repo: "https://github.com/owner/repo" } as never,
    ]);
    vi.mocked(resolveSubmodulePath).mockResolvedValue({
      githubRepo: "https://github.com/owner/repo",
      path: "docs/readme.md",
    });
    vi.mocked(createOrUpdateFileContent).mockResolvedValue({
      path: "docs/readme.md",
      sha: "abc123",
    });

    const result = await postSandboxesFilesHandler(mockRequest);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.uploaded).toEqual([{ path: "docs/readme.md", sha: "abc123" }]);
  });

  it("uploads multiple files successfully", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: ["acc-1"],
      path: "",
      message: "Upload",
      files: [
        { name: "a.txt", content: Buffer.from("a") },
        { name: "b.txt", content: Buffer.from("b") },
      ],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      { github_repo: "https://github.com/owner/repo" } as never,
    ]);
    vi.mocked(resolveSubmodulePath).mockResolvedValue({
      githubRepo: "https://github.com/owner/repo",
      path: "a.txt",
    });
    vi.mocked(createOrUpdateFileContent)
      .mockResolvedValueOnce({ path: "a.txt", sha: "sha-a" })
      .mockResolvedValueOnce({ path: "b.txt", sha: "sha-b" });

    const result = await postSandboxesFilesHandler(mockRequest);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.uploaded).toHaveLength(2);
  });

  it("returns 500 when all uploads fail", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: ["acc-1"],
      path: "",
      message: "Upload",
      files: [{ name: "f.txt", content: Buffer.from("x") }],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      { github_repo: "https://github.com/owner/repo" } as never,
    ]);
    vi.mocked(resolveSubmodulePath).mockResolvedValue({
      githubRepo: "https://github.com/owner/repo",
      path: "f.txt",
    });
    vi.mocked(createOrUpdateFileContent).mockResolvedValue({
      error: "Network error",
    });

    const result = await postSandboxesFilesHandler(mockRequest);
    const body = await result.json();

    expect(result.status).toBe(500);
    expect(body.error).toContain("All uploads failed");
  });

  it("returns partial success with errors array", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: ["acc-1"],
      path: "",
      message: "Upload",
      files: [
        { name: "good.txt", content: Buffer.from("ok") },
        { name: "bad.txt", content: Buffer.from("fail") },
      ],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      { github_repo: "https://github.com/owner/repo" } as never,
    ]);
    vi.mocked(resolveSubmodulePath).mockResolvedValue({
      githubRepo: "https://github.com/owner/repo",
      path: "good.txt",
    });
    vi.mocked(createOrUpdateFileContent)
      .mockResolvedValueOnce({ path: "good.txt", sha: "sha-good" })
      .mockResolvedValueOnce({ error: "Upload failed" });

    const result = await postSandboxesFilesHandler(mockRequest);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.uploaded).toHaveLength(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("bad.txt");
  });
});
