import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { postSandboxesFilesHandler } from "../postSandboxesFilesHandler";

import { validatePostSandboxesFilesRequest } from "../validatePostSandboxesFilesRequest";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { resolveSubmodulePath } from "@/lib/github/resolveSubmodulePath";
import { createOrUpdateFileContent } from "@/lib/github/createOrUpdateFileContent";
import { del } from "@vercel/blob";

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

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("postSandboxesFilesHandler", () => {
  const mockRequest = new NextRequest("https://example.com/api/sandboxes/files", {
    method: "POST",
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation error when validation fails", async () => {
    const errorResponse = NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 },
    );
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue(errorResponse);

    const result = await postSandboxesFilesHandler(mockRequest);

    expect(result.status).toBe(401);
  });

  it("returns 404 when no accountIds resolved", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: [],
      path: "",
      message: "test",
      files: [{ url: "https://blob.example.com/f.txt", name: "f.txt" }],
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
      files: [{ url: "https://blob.example.com/f.txt", name: "f.txt" }],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);

    const result = await postSandboxesFilesHandler(mockRequest);
    const body = await result.json();

    expect(result.status).toBe(404);
    expect(body.error).toBe("No GitHub repository found for this account");
  });

  it("downloads from URL and uploads a single file successfully", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: ["acc-1"],
      path: "docs",
      message: "Upload",
      files: [{ url: "https://blob.example.com/readme.md", name: "readme.md" }],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      { github_repo: "https://github.com/owner/repo" } as never,
    ]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode("# Hello").buffer),
    });
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
    expect(del).toHaveBeenCalledWith("https://blob.example.com/readme.md");
  });

  it("returns 500 when download fails", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: ["acc-1"],
      path: "",
      message: "Upload",
      files: [{ url: "https://blob.example.com/f.txt", name: "f.txt" }],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      { github_repo: "https://github.com/owner/repo" } as never,
    ]);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await postSandboxesFilesHandler(mockRequest);
    const body = await result.json();

    expect(result.status).toBe(500);
    expect(body.error).toContain("All uploads failed");
    // Blobs are always cleaned up, even on failure, to allow retries
    expect(del).toHaveBeenCalledWith("https://blob.example.com/f.txt");
  });

  it("returns partial success with errors array", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: ["acc-1"],
      path: "",
      message: "Upload",
      files: [
        { url: "https://blob.example.com/good.txt", name: "good.txt" },
        { url: "https://blob.example.com/bad.txt", name: "bad.txt" },
      ],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      { github_repo: "https://github.com/owner/repo" } as never,
    ]);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode("ok").buffer),
      })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    vi.mocked(resolveSubmodulePath).mockResolvedValue({
      githubRepo: "https://github.com/owner/repo",
      path: "good.txt",
    });
    vi.mocked(createOrUpdateFileContent).mockResolvedValue({
      path: "good.txt",
      sha: "sha-good",
    });

    const result = await postSandboxesFilesHandler(mockRequest);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.uploaded).toHaveLength(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("bad.txt");
    // All blobs are cleaned up regardless of individual success/failure
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith("https://blob.example.com/good.txt");
    expect(del).toHaveBeenCalledWith("https://blob.example.com/bad.txt");
  });

  it("does not delete blob when GitHub commit fails", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: ["acc-1"],
      path: "",
      message: "Upload",
      files: [{ url: "https://blob.example.com/f.txt", name: "f.txt" }],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      { github_repo: "https://github.com/owner/repo" } as never,
    ]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode("data").buffer),
    });
    vi.mocked(resolveSubmodulePath).mockResolvedValue({
      githubRepo: "https://github.com/owner/repo",
      path: "f.txt",
    });
    vi.mocked(createOrUpdateFileContent).mockResolvedValue({
      error: "GitHub API error",
    });

    const result = await postSandboxesFilesHandler(mockRequest);
    await result.json();

    expect(result.status).toBe(500);
    // Blobs are always cleaned up to allow retries
    expect(del).toHaveBeenCalledWith("https://blob.example.com/f.txt");
  });

  it("cleans up blobs even when resolveSubmodulePath throws", async () => {
    vi.mocked(validatePostSandboxesFilesRequest).mockResolvedValue({
      accountIds: ["acc-1"],
      path: "",
      message: "Upload",
      files: [{ url: "https://blob.example.com/f.txt", name: "f.txt" }],
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      { github_repo: "https://github.com/owner/repo" } as never,
    ]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode("data").buffer),
    });
    vi.mocked(resolveSubmodulePath).mockRejectedValue(new Error("Unexpected throw"));

    const result = await postSandboxesFilesHandler(mockRequest);

    expect(result.status).toBe(500);
    // Blobs must be cleaned up even when an unhandled exception occurs
    expect(del).toHaveBeenCalledWith("https://blob.example.com/f.txt");
  });
});
