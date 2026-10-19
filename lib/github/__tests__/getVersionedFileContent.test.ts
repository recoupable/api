import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { getVersionedFileContent } from "../getVersionedFileContent";

const fetchMock = vi.fn();
const params = { githubRepo: "https://github.com/example/workspace", path: "dir/file #1.txt" };
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GITHUB_TOKEN", "synthetic-token");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("reads bytes and SHA from the same response on main, encoding the path", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      type: "file",
      encoding: "base64",
      content: "aGVs\nbG8=\n",
      sha: "a".repeat(40),
    }),
  );
  expect(await getVersionedFileContent(params)).toEqual({ content: "hello", sha: "a".repeat(40) });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    "https://api.github.com/repos/example/workspace/contents/dir/file%20%231.txt?ref=main",
    expect.objectContaining({ cache: "no-store" }),
  );
});

it("preserves binary bytes as base64", async () => {
  const content = Buffer.from([0, 255, 128]).toString("base64");
  fetchMock.mockResolvedValue(
    Response.json({ type: "file", encoding: "base64", content, sha: "b".repeat(40) }),
  );
  expect(await getVersionedFileContent({ ...params, format: "base64" })).toEqual({
    content,
    sha: "b".repeat(40),
    encoding: "base64",
  });
});

it.each([
  { type: "dir" },
  { type: "file", encoding: "none", sha: "a".repeat(40), content: "" },
  { type: "file", encoding: "base64", sha: "bad", content: "aGk=" },
  { type: "file", target: "elsewhere", encoding: "base64", sha: "a".repeat(40), content: "aGk=" },
])("refuses unsupported or incomplete versioned responses: %j", async file => {
  fetchMock.mockResolvedValue(Response.json(file));
  expect(await getVersionedFileContent(params)).toHaveProperty("error");
});

it("does not expose upstream error bodies", async () => {
  fetchMock.mockResolvedValue(new Response("synthetic-provider-canary", { status: 403 }));
  expect(await getVersionedFileContent(params)).toEqual({ error: "Could not read versioned file" });
});

it("does not fetch with invalid repository input or missing credentials", async () => {
  expect(
    await getVersionedFileContent({ ...params, githubRepo: "https://example.test/repo" }),
  ).toHaveProperty("error");
  vi.stubEnv("GITHUB_TOKEN", "");
  expect(await getVersionedFileContent(params)).toHaveProperty("error");
  expect(fetchMock).not.toHaveBeenCalled();
});
