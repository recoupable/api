import { describe, it, expect } from "vitest";
import { buildPersonalRepoIdentifier } from "@/lib/recoupable/buildPersonalRepoIdentifier";
import { buildPersonalRepoUrl } from "@/lib/recoupable/buildPersonalRepoUrl";

describe("buildPersonalRepoIdentifier", () => {
  it("returns recoupable owner + bare accountId repo", () => {
    expect(
      buildPersonalRepoIdentifier({
        accountId: "fb678396-a68f-4294-ae50-b8cacf9ce77b",
      }),
    ).toEqual({
      owner: "recoupable",
      repo: "fb678396-a68f-4294-ae50-b8cacf9ce77b",
    });
  });

  it("does not embed any name — naming stays stable across renames", () => {
    const { repo } = buildPersonalRepoIdentifier({ accountId: "id-1" });
    expect(repo).toBe("id-1");
  });
});

describe("buildPersonalRepoUrl", () => {
  it("composes the GitHub URL as recoupable/<accountId>", () => {
    expect(
      buildPersonalRepoUrl({
        accountId: "fb678396-a68f-4294-ae50-b8cacf9ce77b",
      }),
    ).toBe("https://github.com/recoupable/fb678396-a68f-4294-ae50-b8cacf9ce77b");
  });
});
