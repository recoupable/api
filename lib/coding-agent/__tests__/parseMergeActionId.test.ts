import { describe, it, expect } from "vitest";
import { parseMergeActionId } from "../parseMergeActionId";

describe("parseMergeActionId", () => {
  it("parses a valid merge action ID", () => {
    expect(parseMergeActionId("merge_pr:recoupable/api#42")).toEqual({
      repo: "recoupable/api",
      number: 42,
    });
  });

  it("parses action ID with nested org/repo", () => {
    expect(parseMergeActionId("merge_pr:org/sub-repo#7")).toEqual({
      repo: "org/sub-repo",
      number: 7,
    });
  });

  it("returns null for invalid format", () => {
    expect(parseMergeActionId("merge_all_prs")).toBeNull();
    expect(parseMergeActionId("merge_pr:")).toBeNull();
    expect(parseMergeActionId("merge_pr:repo")).toBeNull();
    expect(parseMergeActionId("other_action:repo#1")).toBeNull();
  });
});
