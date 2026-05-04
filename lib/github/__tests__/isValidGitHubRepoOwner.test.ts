import { describe, it, expect } from "vitest";
import { isValidGitHubRepoOwner } from "@/lib/github/isValidGitHubRepoOwner";

describe("isValidGitHubRepoOwner", () => {
  it("accepts standard alphanumeric owners", () => {
    expect(isValidGitHubRepoOwner("vercel")).toBe(true);
    expect(isValidGitHubRepoOwner("Recoupable")).toBe(true);
    expect(isValidGitHubRepoOwner("octo-cat-42")).toBe(true);
    expect(isValidGitHubRepoOwner("a")).toBe(true);
  });

  it("rejects empty and too-long owners", () => {
    expect(isValidGitHubRepoOwner("")).toBe(false);
    expect(isValidGitHubRepoOwner("a".repeat(40))).toBe(false);
  });

  it("rejects underscores and dots (allowed in repo names but not owner logins)", () => {
    expect(isValidGitHubRepoOwner("snake_case")).toBe(false);
    expect(isValidGitHubRepoOwner("dot.case")).toBe(false);
  });

  it("rejects leading, trailing, and consecutive hyphens", () => {
    expect(isValidGitHubRepoOwner("-leading")).toBe(false);
    expect(isValidGitHubRepoOwner("trailing-")).toBe(false);
    expect(isValidGitHubRepoOwner("double--hyphen")).toBe(false);
  });

  it("rejects characters outside [a-zA-Z0-9-]", () => {
    expect(isValidGitHubRepoOwner("bad@owner")).toBe(false);
    expect(isValidGitHubRepoOwner("with space")).toBe(false);
    expect(isValidGitHubRepoOwner("slash/owner")).toBe(false);
  });
});
