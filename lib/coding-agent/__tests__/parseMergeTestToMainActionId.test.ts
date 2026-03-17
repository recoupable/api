import { describe, it, expect } from "vitest";
import { parseMergeTestToMainActionId } from "../parseMergeTestToMainActionId";

describe("parseMergeTestToMainActionId", () => {
  it("parses a valid action ID", () => {
    expect(parseMergeTestToMainActionId("merge_test_to_main:recoupable/api")).toBe(
      "recoupable/api",
    );
  });

  it("parses action ID with hyphenated repo name", () => {
    expect(parseMergeTestToMainActionId("merge_test_to_main:org/sub-repo")).toBe("org/sub-repo");
  });

  it("returns null for missing repo", () => {
    expect(parseMergeTestToMainActionId("merge_test_to_main:")).toBeNull();
  });

  it("returns null for repo without slash", () => {
    expect(parseMergeTestToMainActionId("merge_test_to_main:noslash")).toBeNull();
  });

  it("returns null for wrong prefix", () => {
    expect(parseMergeTestToMainActionId("other_action:repo/name")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseMergeTestToMainActionId("")).toBeNull();
  });
});
