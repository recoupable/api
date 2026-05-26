import { describe, it, expect } from "vitest";
import { buildPersonalRepoIdentifier } from "@/lib/recoupable/buildPersonalRepoIdentifier";
import { buildPersonalRepoUrl } from "@/lib/recoupable/buildPersonalRepoUrl";

describe("buildPersonalRepoIdentifier", () => {
  it("produces recoupable owner + <kebab(name)>-<account_id> repo", () => {
    expect(
      buildPersonalRepoIdentifier({
        accountName: "Sweetman",
        accountId: "fb678396-a68f-4294-ae50-b8cacf9ce77b",
      }),
    ).toEqual({
      owner: "recoupable",
      repo: "sweetman-fb678396-a68f-4294-ae50-b8cacf9ce77b",
    });
  });

  it("kebabs dotted display names", () => {
    expect(
      buildPersonalRepoIdentifier({
        accountName: "sweetman.eth",
        accountId: "id-1",
      }),
    ).toEqual({ owner: "recoupable", repo: "sweetman-eth-id-1" });
  });
});

describe("buildPersonalRepoUrl", () => {
  it("composes the GitHub URL from the identifier", () => {
    expect(
      buildPersonalRepoUrl({
        accountName: "Sweetman",
        accountId: "fb678396-a68f-4294-ae50-b8cacf9ce77b",
      }),
    ).toBe("https://github.com/recoupable/sweetman-fb678396-a68f-4294-ae50-b8cacf9ce77b");
  });
});
