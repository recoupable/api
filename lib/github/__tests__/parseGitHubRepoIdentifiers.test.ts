import { describe, it, expect } from "vitest";
import { parseGitHubRepoIdentifiers } from "@/lib/github/parseGitHubRepoIdentifiers";

describe("parseGitHubRepoIdentifiers", () => {
  it("parses owner + repo from a plain https URL", () => {
    expect(parseGitHubRepoIdentifiers("https://github.com/Myco-WTF/Sweetman")).toEqual({
      owner: "Myco-WTF",
      repo: "Sweetman",
    });
  });

  it("strips a trailing .git suffix", () => {
    expect(parseGitHubRepoIdentifiers("https://github.com/recoupable/api.git")).toEqual({
      owner: "recoupable",
      repo: "api",
    });
  });

  it("strips a trailing slash", () => {
    expect(parseGitHubRepoIdentifiers("https://github.com/recoupable/api/")).toEqual({
      owner: "recoupable",
      repo: "api",
    });
  });

  it("accepts ssh-style URLs (git@github.com:owner/repo.git)", () => {
    expect(parseGitHubRepoIdentifiers("git@github.com:Myco-WTF/Sweetman.git")).toEqual({
      owner: "Myco-WTF",
      repo: "Sweetman",
    });
  });

  it("returns null for non-github URLs", () => {
    expect(parseGitHubRepoIdentifiers("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("returns null for the empty string", () => {
    expect(parseGitHubRepoIdentifiers("")).toBeNull();
  });

  it("returns null for an https URL missing the repo segment", () => {
    expect(parseGitHubRepoIdentifiers("https://github.com/owner")).toBeNull();
  });

  it("returns null when input is null/undefined", () => {
    expect(parseGitHubRepoIdentifiers(null)).toBeNull();
    expect(parseGitHubRepoIdentifiers(undefined)).toBeNull();
  });
});
