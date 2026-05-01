import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrUpdateFileContent } from "../createOrUpdateFileContent";
import { parseGitHubRepoUrl } from "../parseGitHubRepoUrl";

vi.mock("../parseGitHubRepoUrl", () => ({
  parseGitHubRepoUrl: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("createOrUpdateFileContent", () => {
  const validParams = {
    githubRepo: "https://github.com/owner/repo",
    path: "test/file.txt",
    content: Buffer.from("hello"),
    message: "Upload file",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(parseGitHubRepoUrl).mockReturnValue({ owner: "owner", repo: "repo" });
    process.env.GITHUB_TOKEN = "test-token";
  });

  it("returns error for invalid GitHub URL", async () => {
    vi.mocked(parseGitHubRepoUrl).mockReturnValue(null);

    const result = await createOrUpdateFileContent(validParams);

    expect(result).toEqual({ error: "Invalid GitHub repository URL" });
  });

  it("returns error when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;

    const result = await createOrUpdateFileContent(validParams);

    expect(result).toEqual({ error: "GitHub token not configured" });
  });

  it("creates a new file when it does not exist", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: { path: "test/file.txt", sha: "abc123" } }),
    });

    const result = await createOrUpdateFileContent(validParams);

    expect(result).toEqual({ path: "test/file.txt", sha: "abc123" });
    const putBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(putBody.sha).toBeUndefined();
    expect(putBody.branch).toBeUndefined();
  });

  it("updates an existing file with its SHA", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sha: "existing-sha" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ content: { path: "test/file.txt", sha: "new-sha" } }),
      });

    const result = await createOrUpdateFileContent(validParams);

    expect(result).toEqual({ path: "test/file.txt", sha: "new-sha" });
    const putBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(putBody.sha).toBe("existing-sha");
  });

  it("returns error when GET fails with non-404 status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Rate limited"),
    });

    const result = await createOrUpdateFileContent(validParams);

    expect(result).toEqual({ error: "Failed to check existing file: 403 Rate limited" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns error when PUT fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: () => Promise.resolve("Validation failed"),
    });

    const result = await createOrUpdateFileContent(validParams);

    expect(result).toEqual({ error: "Failed to upload file: 422 Validation failed" });
  });

  it("returns error on network failure during GET", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await createOrUpdateFileContent(validParams);

    expect(result).toEqual({ error: "Network error checking existing file: Connection refused" });
  });

  it("returns error on network failure during PUT", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockRejectedValueOnce(new Error("Timeout"));

    const result = await createOrUpdateFileContent(validParams);

    expect(result).toEqual({ error: "Network error uploading file: Timeout" });
  });

  it("encodes path segments in the URL", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: { path: "dir/file #1.txt", sha: "abc" } }),
    });

    await createOrUpdateFileContent({
      ...validParams,
      path: "dir/file #1.txt",
    });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/contents/dir/file%20%231.txt");
  });

  it("does not hardcode branch in PUT body", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: { path: "file.txt", sha: "abc" } }),
    });

    await createOrUpdateFileContent(validParams);

    const putBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(putBody).not.toHaveProperty("branch");
  });
});
