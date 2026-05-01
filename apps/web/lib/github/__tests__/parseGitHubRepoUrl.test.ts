import { describe, it, expect } from "vitest";
import { parseGitHubRepoUrl } from "../parseGitHubRepoUrl";

describe("parseGitHubRepoUrl", () => {
  it("parses standard GitHub URL", () => {
    expect(parseGitHubRepoUrl("https://github.com/Recoupable-Com/my-repo")).toEqual({
      owner: "Recoupable-Com",
      repo: "my-repo",
    });
  });

  it("parses URL with trailing slash", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner/repo/")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses URL with .git suffix", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("returns null for non-GitHub URL", () => {
    expect(parseGitHubRepoUrl("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("returns null for malformed URL", () => {
    expect(parseGitHubRepoUrl("not-a-url")).toBeNull();
  });

  it("returns null for GitHub URL without repo", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseGitHubRepoUrl("")).toBeNull();
  });
});
