import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRawFileContent } from "../getRawFileContent";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("getRawFileContent", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, GITHUB_TOKEN: "test-token" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns content on success with auth header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("console.log('hello');"),
    });

    const result = await getRawFileContent({
      githubRepo: "https://github.com/user/repo",
      path: "src/index.ts",
    });

    expect(result).toEqual({ content: "console.log('hello');" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/user/repo/main/src/index.ts",
      { headers: { Authorization: "Bearer test-token" } },
    );
  });

  it("returns error on invalid GitHub URL", async () => {
    const result = await getRawFileContent({
      githubRepo: "https://not-github.com/user/repo",
      path: "src/index.ts",
    });

    expect(result).toEqual({ error: "Invalid GitHub repository URL" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns error on 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const result = await getRawFileContent({
      githubRepo: "https://github.com/user/repo",
      path: "nonexistent.ts",
    });

    expect(result).toEqual({ error: "File not found in repository" });
  });

  it("returns error on other HTTP failures", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await getRawFileContent({
      githubRepo: "https://github.com/user/repo",
      path: "src/index.ts",
    });

    expect(result).toEqual({ error: "Failed to fetch file: Internal Server Error" });
  });

  it("handles GitHub URLs with .git suffix", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("# README"),
    });

    const result = await getRawFileContent({
      githubRepo: "https://github.com/user/repo.git",
      path: "README.md",
    });

    expect(result).toEqual({ content: "# README" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/user/repo/main/README.md",
      { headers: { Authorization: "Bearer test-token" } },
    );
  });
});
