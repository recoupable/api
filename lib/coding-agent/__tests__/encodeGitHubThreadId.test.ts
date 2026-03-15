import { describe, it, expect } from "vitest";
import { encodeGitHubThreadId } from "../encodeGitHubThreadId";

describe("encodeGitHubThreadId", () => {
  it("encodes PR-level thread ID", () => {
    expect(encodeGitHubThreadId({ owner: "recoupable", repo: "tasks", prNumber: 68 })).toBe(
      "github:recoupable/tasks:68",
    );
  });

  it("encodes review comment thread ID", () => {
    expect(
      encodeGitHubThreadId({
        owner: "recoupable",
        repo: "api",
        prNumber: 266,
        reviewCommentId: 2898626443,
      }),
    ).toBe("github:recoupable/api:266:rc:2898626443");
  });
});
