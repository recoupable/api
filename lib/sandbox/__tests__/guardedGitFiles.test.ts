import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/sandboxes/file/route";
import { POST } from "@/app/api/sandboxes/files/route";
import { createOrUpdateFileContent } from "@/lib/github/createOrUpdateFileContent";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/sandbox/buildGetSandboxesParams", () => ({
  buildGetSandboxesParams: vi.fn(async () => ({ params: { accountIds: ["account"] } })),
}));
vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(async () => [
    { github_repo: "https://github.com/example/workspace" },
  ]),
}));
vi.mock("@/lib/github/resolveSubmodulePath", () => ({
  resolveSubmodulePath: vi.fn(async ({ path }) => ({
    githubRepo: "https://github.com/example/child",
    path,
  })),
}));
vi.mock("@vercel/blob", () => ({ del: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const sha = (text: string) =>
  createHash("sha1")
    .update(`blob ${Buffer.byteLength(text)}\0${text}`)
    .digest("hex");
let stored: string;
const provider = vi.fn();
const read = () =>
  GET(
    new NextRequest("https://api.example/api/sandboxes/file?path=draft.txt&include_revision=true"),
  );
const save = (content: string, expected_sha?: string) =>
  POST(
    new NextRequest("https://api.example/api/sandboxes/files", {
      method: "POST",
      body: JSON.stringify({
        files: [
          {
            name: "draft.txt",
            url: `https://blob.example/${encodeURIComponent(content)}`,
            ...(expected_sha !== undefined && { expected_sha }),
          },
        ],
      }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GITHUB_TOKEN", "synthetic-token");
  stored = "Original draft";
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "account" } as never);
  provider.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.startsWith("https://blob.example/"))
      return new Response(decodeURIComponent(url.split("/").at(-1)!));
    expect(url).toMatch(
      /^https:\/\/api.github.com\/repos\/example\/child\/contents\/draft.txt(?:\?ref=main)?$/,
    );
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      if (body.sha !== sha(stored))
        return Response.json({ message: "synthetic upstream conflict" }, { status: 409 });
      stored = Buffer.from(body.content, "base64").toString();
      return Response.json({ content: { path: "draft.txt", sha: sha(stored) } });
    }
    return Response.json({
      type: "file",
      sha: sha(stored),
      encoding: "base64",
      content: Buffer.from(stored).toString("base64"),
    });
  });
  vi.stubGlobal("fetch", provider);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("guarded Git file route exports", () => {
  it("does not substitute a newer SHA for the caller condition", async () => {
    const observed = sha(stored);
    stored = "Concurrent newer draft";
    const result = await createOrUpdateFileContent({
      githubRepo: "https://github.com/example/child",
      path: "draft.txt",
      content: Buffer.from("Stale draft"),
      message: "Edit",
      expectedSha: observed,
    });
    expect(result).toMatchObject({ conflict: true });
    expect(stored).toBe("Concurrent newer draft");
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("rejects a stale second reader without overwriting the first save", async () => {
    const a = await (await read()).json();
    const b = await (await read()).json();
    expect(a).toMatchObject({ content: stored, sha: sha(stored) });
    expect(b.sha).toBe(a.sha);
    const first = await save("First reader's newer draft", a.sha);
    expect(first.status).toBe(200);
    expect((await first.json()).uploaded[0].sha).toBe(sha(stored));
    const second = await save("Stale replacement", b.sha);
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ status: "error", conflicts: ["draft.txt"] });
    expect(stored).toBe("First reader's newer draft");
    const puts = provider.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(puts).toHaveLength(2);
    for (const [, init] of puts)
      expect(JSON.parse(String(init.body))).toMatchObject({ sha: a.sha, branch: "main" });
    expect(
      provider.mock.calls.filter(
        ([url, init]) => String(url).includes("api.github.com") && init?.method !== "PUT",
      ),
    ).toHaveLength(2);
  });

  it("does not leak an unexpected guarded upstream failure or retry it", async () => {
    provider.mockResolvedValueOnce(new Response("synthetic-provider-canary", { status: 403 }));
    const result = await createOrUpdateFileContent({
      githubRepo: "https://github.com/example/child",
      path: "draft.txt",
      content: Buffer.from("Replacement"),
      message: "Edit",
      expectedSha: sha(stored),
    });
    expect(result).toEqual({ error: "Could not save versioned file" });
    expect(stored).toBe("Original draft");
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid revision query before fetching", async () => {
    const response = await GET(
      new NextRequest("https://api.example/api/sandboxes/file?path=draft.txt&include_revision=yes"),
    );
    expect(response.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    "../../../other/repo/contents/x",
    "dir/../draft.txt",
    "./draft.txt",
    "dir\\..\\draft.txt",
  ])("rejects unsafe paths before provider access: %s", async path => {
    for (const suffix of ["", "&include_revision=true"]) {
      const response = await GET(
        new NextRequest(
          `https://api.example/api/sandboxes/file?path=${encodeURIComponent(path)}${suffix}`,
        ),
      );
      expect(response.status).toBe(400);
    }
    const response = await POST(
      new NextRequest("https://api.example/api/sandboxes/files", {
        method: "POST",
        body: JSON.stringify({
          path,
          files: [{ name: "draft.txt", url: "https://blob.example/draft" }],
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(["../x", "dir\\x", "a/", "./x", "\ud800"])(
    "rejects an unsafe upload name before fetching: %s",
    async name => {
      const response = await POST(
        new NextRequest("https://api.example/api/sandboxes/files", {
          method: "POST",
          body: JSON.stringify({ files: [{ name, url: "https://blob.example/draft" }] }),
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ missing_fields: ["files", 0, "name"] });
      expect(provider).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "a".repeat(40)])("accepts a valid or omitted SHA: %s", async expected => {
    const response = await save("Valid", expected === undefined ? undefined : sha(stored));
    expect(response.status).toBe(200);
  });

  it.each(["A".repeat(40), "a".repeat(39), "g".repeat(40)])(
    "rejects malformed SHA at its field path: %s",
    async expected => {
      const response = await save("Invalid", expected);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ missing_fields: ["files", 0, "expected_sha"] });
      expect(provider).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid conditions before downloading or writing", async () => {
    expect((await save("Invalid", "")).status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it("authenticates before fetching file contents or writing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect((await read()).status).toBe(401);
    expect((await save("Denied", "a".repeat(40))).status).toBe(401);
    expect(provider).not.toHaveBeenCalled();
  });

  it("preserves the legacy upload without a condition", async () => {
    const response = await save("Legacy replacement");
    expect(response.status).toBe(200);
    expect(stored).toBe("Legacy replacement");
    const put = provider.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(JSON.parse(String(put[1].body))).not.toHaveProperty("branch");
  });
});
