import { describe, it, expect } from "vitest";
import { buildSource } from "@/lib/sandbox/buildSource";

describe("buildSource", () => {
  it("returns repo + branch when branch is provided", () => {
    expect(buildSource({ repoUrl: "https://github.com/o/r", branch: "main" })).toEqual({
      repo: "https://github.com/o/r",
      branch: "main",
    });
  });

  it("omits branch when not provided", () => {
    expect(buildSource({ repoUrl: "https://github.com/o/r" })).toEqual({
      repo: "https://github.com/o/r",
    });
  });
});
