import { describe, it, expect } from "vitest";
import { buildCommitData } from "@/lib/chat/auto-commit/buildCommitData";

describe("buildCommitData", () => {
  describe("success path", () => {
    it("returns status='success' with the commit url when the commit was pushed", () => {
      const data = buildCommitData(
        {
          committed: true,
          pushed: true,
          commitSha: "abc123",
          commitMessage: "feat: thing",
        },
        "recoupable",
        "api",
      );
      expect(data).toEqual({
        status: "success",
        committed: true,
        pushed: true,
        commitMessage: "feat: thing",
        commitSha: "abc123",
        url: "https://github.com/recoupable/api/commit/abc123",
      });
    });

    it("omits the url when the commit landed locally but wasn't pushed", () => {
      const data = buildCommitData(
        {
          committed: true,
          pushed: false,
          commitSha: "abc123",
          commitMessage: "feat: thing",
        },
        "recoupable",
        "api",
      );
      expect(data.url).toBeUndefined();
      expect(data.status).toBe("success");
    });

    it("omits the url when commitSha is missing (paranoia)", () => {
      const data = buildCommitData(
        { committed: true, pushed: true, commitMessage: "feat: thing" },
        "recoupable",
        "api",
      );
      expect(data.url).toBeUndefined();
    });
  });

  describe("error path", () => {
    it("returns status='error' with the error message", () => {
      const data = buildCommitData(
        {
          committed: false,
          pushed: false,
          error: "Failed to stage changes",
        },
        "recoupable",
        "api",
      );
      expect(data).toEqual({
        status: "error",
        committed: false,
        pushed: false,
        commitMessage: undefined,
        commitSha: undefined,
        url: undefined,
        error: "Failed to stage changes",
      });
    });

    it("still includes the url when commit pushed but result was marked error (partial success edge)", () => {
      // hypothetical: commit pushed, then a later step set error
      const data = buildCommitData(
        {
          committed: true,
          pushed: true,
          commitSha: "abc123",
          commitMessage: "feat: thing",
          error: "post-push hook failed",
        },
        "recoupable",
        "api",
      );
      expect(data.status).toBe("error");
      expect(data.url).toBe("https://github.com/recoupable/api/commit/abc123");
    });
  });

  describe("skipped path", () => {
    it("returns status='skipped' when nothing was committed (no changes)", () => {
      const data = buildCommitData({ committed: false, pushed: false }, "recoupable", "api");
      expect(data).toEqual({
        status: "skipped",
        committed: false,
        pushed: false,
      });
    });
  });

  describe("url encoding", () => {
    it("encodes owner / repo / sha in the URL path", () => {
      const data = buildCommitData(
        { committed: true, pushed: true, commitSha: "abc/def" },
        "owner with space",
        "repo+name",
      );
      expect(data.url).toBe("https://github.com/owner%20with%20space/repo%2Bname/commit/abc%2Fdef");
    });
  });
});
