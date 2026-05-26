import { describe, it, expect, beforeEach, vi } from "vitest";
import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import { repositoryExists } from "@/lib/github/repositoryExists";
import { createRepository } from "@/lib/github/createRepository";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";

vi.mock("@/lib/github/getServiceGithubToken", () => ({
  getServiceGithubToken: vi.fn(),
}));
vi.mock("@/lib/github/repositoryExists", () => ({
  repositoryExists: vi.fn(),
}));
vi.mock("@/lib/github/createRepository", () => ({
  createRepository: vi.fn(),
}));

describe("ensurePersonalRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when GITHUB_TOKEN is missing", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue(undefined);

    const result = await ensurePersonalRepo({
      accountName: "Sweetman",
      accountId: "id-1",
    });

    expect(result).toBeNull();
    expect(repositoryExists).not.toHaveBeenCalled();
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("returns existing repo URL without creating when repository already exists", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(true);

    const result = await ensurePersonalRepo({
      accountName: "Sweetman",
      accountId: "id-1",
    });

    expect(result).toEqual({
      cloneUrl: "https://github.com/recoupable/sweetman-id-1",
      repoUrl: "https://github.com/recoupable/sweetman-id-1",
      owner: "recoupable",
      repoName: "sweetman-id-1",
    });
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("returns null when the existence check fails for non-404 reasons", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(null);

    const result = await ensurePersonalRepo({
      accountName: "Sweetman",
      accountId: "id-1",
    });

    expect(result).toBeNull();
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("creates the repo when it doesn't exist and returns the new URL", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(createRepository).mockResolvedValue({
      success: true,
      cloneUrl: "https://github.com/recoupable/sweetman-id-1.git",
      repoUrl: "https://github.com/recoupable/sweetman-id-1",
      owner: "recoupable",
      repoName: "sweetman-id-1",
    });

    const result = await ensurePersonalRepo({
      accountName: "Sweetman",
      accountId: "id-1",
    });

    expect(result).toEqual({
      cloneUrl: "https://github.com/recoupable/sweetman-id-1.git",
      repoUrl: "https://github.com/recoupable/sweetman-id-1",
      owner: "recoupable",
      repoName: "sweetman-id-1",
    });
    expect(createRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "recoupable",
        name: "sweetman-id-1",
        isPrivate: true,
        token: "tok",
      }),
    );
  });

  it("returns null when repo creation fails", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(createRepository).mockResolvedValue({
      success: false,
      error: "Permission denied",
    });

    const result = await ensurePersonalRepo({
      accountName: "Sweetman",
      accountId: "id-1",
    });

    expect(result).toBeNull();
  });
});
