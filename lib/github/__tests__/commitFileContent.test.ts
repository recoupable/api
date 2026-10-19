import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commitFileContent } from "../commitFileContent";
import { isRelativeRepoFilePath } from "../isRelativeRepoFilePath";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it.each([undefined, "", "invalid"])(
  "fails closed for a guarded commit without a valid SHA: %s",
  async sha => {
    const result = await commitFileContent({
      url: "https://api.github.com/repos/example/repo/contents/draft.txt",
      token: "synthetic",
      message: "Edit",
      content: Buffer.from("Draft"),
      guarded: true,
      sha,
    });
    expect(result).toHaveProperty("error");
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it.each(["\ud800", "draft-\udfff.txt"])("rejects malformed Unicode without throwing", path => {
  expect(isRelativeRepoFilePath(path)).toBe(false);
});

it("supports well-formed international filenames", () => {
  expect(isRelativeRepoFilePath("drafts/音楽-🎵.txt")).toBe(true);
});
