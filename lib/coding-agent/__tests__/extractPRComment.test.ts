import { describe, it, expect } from "vitest";
import { extractPRComment } from "../extractPRComment";

const BASE_PAYLOAD = {
  action: "created",
  issue: {
    number: 66,
    pull_request: { url: "https://api.github.com/repos/recoupable/tasks/pulls/66" },
  },
  comment: {
    id: 123,
    body: "@recoup-coding-agent make the button blue",
    user: { login: "sweetmantech" },
  },
  repository: {
    full_name: "recoupable/tasks",
  },
};

describe("extractPRComment", () => {
  it("returns null for unsupported events", () => {
    expect(extractPRComment("push", BASE_PAYLOAD)).toBeNull();
  });

  it("returns null when action is not created", () => {
    expect(extractPRComment("issue_comment", { ...BASE_PAYLOAD, action: "deleted" })).toBeNull();
  });

  it("returns null when bot is not mentioned", () => {
    const payload = {
      ...BASE_PAYLOAD,
      comment: { body: "just a regular comment" },
    };
    expect(extractPRComment("issue_comment", payload)).toBeNull();
  });

  it("returns null when issue has no pull_request", () => {
    const payload = {
      ...BASE_PAYLOAD,
      issue: { number: 66 },
    };
    expect(extractPRComment("issue_comment", payload)).toBeNull();
  });

  it("extracts from issue_comment with GitHubThreadId", () => {
    const result = extractPRComment("issue_comment", BASE_PAYLOAD);
    expect(result).toEqual({
      thread: { owner: "recoupable", repo: "tasks", prNumber: 66 },
      branch: "",
      commentBody: "@recoup-coding-agent make the button blue",
    });
  });

  it("extracts from pull_request_review_comment with branch and reviewCommentId", () => {
    const payload = {
      action: "created",
      pull_request: {
        number: 266,
        head: { ref: "feature/my-branch" },
      },
      comment: {
        id: 2898626443,
        body: "@recoup-coding-agent fix the typo",
      },
      repository: {
        full_name: "recoupable/api",
      },
    };
    const result = extractPRComment("pull_request_review_comment", payload);
    expect(result).toEqual({
      thread: { owner: "recoupable", repo: "api", prNumber: 266, reviewCommentId: 2898626443 },
      branch: "feature/my-branch",
      commentBody: "@recoup-coding-agent fix the typo",
    });
  });

  it("returns null for pull_request_review_comment without pull_request", () => {
    const payload = {
      action: "created",
      comment: { body: "@recoup-coding-agent test" },
      repository: { full_name: "recoupable/api" },
    };
    expect(extractPRComment("pull_request_review_comment", payload)).toBeNull();
  });
});
