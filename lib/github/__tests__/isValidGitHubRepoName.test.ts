import { describe, it, expect } from "vitest";
import { isValidGitHubRepoName } from "@/lib/github/isValidGitHubRepoName";

describe("isValidGitHubRepoName", () => {
  it("accepts standard repo names", () => {
    expect(isValidGitHubRepoName("api")).toBe(true);
    expect(isValidGitHubRepoName("hello-world")).toBe(true);
    expect(isValidGitHubRepoName("snake_case")).toBe(true);
    expect(isValidGitHubRepoName("dot.in.middle")).toBe(true);
    expect(isValidGitHubRepoName("v1.2.3")).toBe(true);
  });

  it("rejects empty and too-long names", () => {
    expect(isValidGitHubRepoName("")).toBe(false);
    expect(isValidGitHubRepoName("a".repeat(101))).toBe(false);
  });

  it("rejects reserved dot-only names", () => {
    expect(isValidGitHubRepoName(".")).toBe(false);
    expect(isValidGitHubRepoName("..")).toBe(false);
  });

  it("rejects names ending in .git", () => {
    expect(isValidGitHubRepoName("repo.git")).toBe(false);
    expect(isValidGitHubRepoName("Repo.GIT")).toBe(false);
    expect(isValidGitHubRepoName(".git")).toBe(false);
  });

  it("rejects characters outside [\\w.-]", () => {
    expect(isValidGitHubRepoName("with space")).toBe(false);
    expect(isValidGitHubRepoName("repo@bad")).toBe(false);
    expect(isValidGitHubRepoName("slash/repo")).toBe(false);
  });
});
