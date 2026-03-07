import { describe, it, expect } from "vitest";
import { parseGitHubThreadId } from "../parseGitHubThreadId";

describe("parseGitHubThreadId", () => {
  it("parses github:owner/repo:prNumber format", () => {
    const result = parseGitHubThreadId("github:recoupable/tasks:68");
    expect(result).toEqual({ repo: "recoupable/tasks", prNumber: 68 });
  });

  it("returns null for non-github thread IDs", () => {
    expect(parseGitHubThreadId("slack:C123:1234567890.123456")).toBeNull();
  });

  it("returns null for malformed github thread IDs", () => {
    expect(parseGitHubThreadId("github:badformat")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseGitHubThreadId("")).toBeNull();
  });
});
