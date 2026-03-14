import { describe, it, expect } from "vitest";
import { buildPRStateKey } from "../prState/buildPRStateKey";

describe("buildPRStateKey", () => {
  it("builds the correct key", () => {
    expect(buildPRStateKey("recoupable/api", "agent/fix-bug")).toBe(
      "coding-agent:pr:recoupable/api:agent/fix-bug",
    );
  });
});
