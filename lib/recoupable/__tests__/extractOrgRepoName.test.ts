import { describe, it, expect } from "vitest";
import { extractOrgRepoName } from "@/lib/recoupable/extractOrgRepoName";

describe("extractOrgRepoName", () => {
  it("extracts the repo name from a recoupable org clone URL", () => {
    expect(extractOrgRepoName("https://github.com/recoupable/org-rostrum-pacific-abc123")).toBe(
      "org-rostrum-pacific-abc123",
    );
  });

  it("strips a trailing .git suffix", () => {
    expect(extractOrgRepoName("https://github.com/recoupable/myorg.git")).toBe("myorg");
  });

  it("strips a trailing slash", () => {
    expect(extractOrgRepoName("https://github.com/recoupable/myorg/")).toBe("myorg");
  });

  it("returns null for non-recoupable orgs", () => {
    expect(extractOrgRepoName("https://github.com/someoneelse/repo")).toBeNull();
  });

  it("returns null for nested paths beyond the repo segment", () => {
    expect(extractOrgRepoName("https://github.com/recoupable/repo/blob/main/x")).toBeNull();
  });

  it("returns null for non-GitHub URLs", () => {
    expect(extractOrgRepoName("https://gitlab.com/recoupable/repo")).toBeNull();
    expect(extractOrgRepoName("not-a-url")).toBeNull();
  });

  it("returns null for the org root with no repo", () => {
    expect(extractOrgRepoName("https://github.com/recoupable/")).toBeNull();
    expect(extractOrgRepoName("https://github.com/recoupable")).toBeNull();
  });
});
