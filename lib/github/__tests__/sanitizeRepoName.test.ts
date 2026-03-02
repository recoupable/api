import { describe, it, expect } from "vitest";

import { sanitizeRepoName } from "../sanitizeRepoName";

describe("sanitizeRepoName", () => {
  it("lowercases the name", () => {
    expect(sanitizeRepoName("MyRepo")).toBe("myrepo");
  });

  it("replaces spaces with hyphens", () => {
    expect(sanitizeRepoName("my repo name")).toBe("my-repo-name");
  });

  it("replaces special characters with hyphens", () => {
    expect(sanitizeRepoName("my@repo!name")).toBe("my-repo-name");
  });

  it("collapses multiple hyphens", () => {
    expect(sanitizeRepoName("my---repo")).toBe("my-repo");
  });

  it("trims leading and trailing hyphens", () => {
    expect(sanitizeRepoName("-my-repo-")).toBe("my-repo");
  });

  it("returns 'account' for empty string", () => {
    expect(sanitizeRepoName("")).toBe("account");
  });

  it("returns 'account' for string of only special chars", () => {
    expect(sanitizeRepoName("@#$%")).toBe("account");
  });

  it("handles already valid names", () => {
    expect(sanitizeRepoName("valid-name")).toBe("valid-name");
  });
});
