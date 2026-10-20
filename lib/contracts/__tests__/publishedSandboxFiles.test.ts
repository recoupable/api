import Ajv from "ajv";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/sandboxes/file/route";
import { getVersionedFileContent } from "@/lib/github/getVersionedFileContent";
import { commitFileContent } from "@/lib/github/commitFileContent";
import { buildFileUploadResponse } from "@/lib/sandbox/buildFileUploadResponse";
import { validatePostSandboxesFilesRequest } from "@/lib/sandbox/validatePostSandboxesFilesRequest";
import fixture from "../fixtures/published-docs.json";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn().mockResolvedValue({ accountId: "fixture-account", orgId: null }),
}));
vi.mock("@/lib/sandbox/buildGetSandboxesParams", () => ({
  buildGetSandboxesParams: vi
    .fn()
    .mockResolvedValue({ params: { accountIds: ["fixture-account"] } }),
}));
vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi
    .fn()
    .mockResolvedValue([{ github_repo: "https://github.com/example/drafts" }]),
}));
vi.mock("@/lib/github/resolveSubmodulePath", () => ({
  resolveSubmodulePath: vi.fn(async (params: { githubRepo: string; path: string }) => params),
}));
vi.mock("@/lib/github/getRawFileContent", () => ({ getRawFileContent: vi.fn() }));
vi.mock("@/lib/github/getVersionedFileContent", () => ({ getVersionedFileContent: vi.fn() }));

const ajv = new Ajv({ allErrors: true });
ajv.addKeyword({ keyword: "example", valid: true });

function publishedContract(method: string, path: string, status: number) {
  expect(
    fixture.guardedGitFiles,
    "Missing coordinated guarded Git documentation fixture",
  ).toBeDefined();
  const contract = fixture.guardedGitFiles.responses.find(
    item => item.method === method && item.path === path && item.status === status,
  );
  expect(contract, `Missing ${method} ${path} ${status} response contract`).toBeDefined();
  const fields =
    method === "GET"
      ? ["status", "content", "sha", "encoding"]
      : status === 200
        ? ["status", "uploaded", "errors", "conflicts"]
        : ["status", "error", "conflicts"];
  for (const field of fields) expect(contract!.schema.properties).toHaveProperty(field);
  if (method === "POST" && status === 200) {
    expect(contract!.schema.properties).toHaveProperty("uploaded.items.properties.path");
    expect(contract!.schema.properties).toHaveProperty("uploaded.items.properties.sha");
  }
  return ajv.compile(contract!.schema);
}

describe("published guarded Git file contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([undefined, "base64" as const])(
    "matches the versioned GET schema with encoding %s",
    async encoding => {
      expect(
        fixture.guardedGitFiles,
        "Missing coordinated guarded Git documentation fixture",
      ).toBeDefined();
      const query = new URLSearchParams(fixture.guardedGitFiles.readQuery);
      if (encoding) query.set("path", "drafts/cover.png");
      const result = {
        content: encoding ? "aGVsbG8=" : "Release notes",
        sha: "a".repeat(40),
        ...(encoding && { encoding }),
      };
      vi.mocked(getVersionedFileContent).mockResolvedValue(result);
      const response = await GET(
        new NextRequest(`https://api.example/api/sandboxes/file?${query}`),
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toEqual({ status: "success", ...result });
      const validate = publishedContract("GET", "/api/sandboxes/file", 200);
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    },
  );

  it("preserves the observed condition in the copyable upload example", async () => {
    expect(
      fixture.guardedGitFiles,
      "Missing coordinated guarded Git documentation fixture",
    ).toBeDefined();
    const body = fixture.guardedGitFiles.upload;
    expect(fixture.guardedGitFiles.uploadSchema.properties).toHaveProperty(
      "files.items.properties.expected_sha",
    );
    const result = await validatePostSandboxesFilesRequest(
      new NextRequest("https://api.example/api/sandboxes/files", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.files).toEqual(body.files);
      expect(result.files[0].expected_sha).toMatch(/^[a-f0-9]{40}$/);
    }
  });

  it.each([404, 422])(
    "maps repository rejection %i to an ordinary upload failure",
    async status => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("Synthetic repository rejection", { status }));
      try {
        const result = await commitFileContent({
          url: "https://api.example/repos/example/drafts/contents/notes.txt",
          token: "synthetic",
          message: "Save draft",
          content: Buffer.from("Edited draft"),
          sha: fixture.guardedGitFiles.upload.files[0].expected_sha,
          guarded: true,
        });
        expect(result).toEqual({ error: "Could not save versioned file" });
        if (!("error" in result)) throw new Error("Expected a rejected save");
        const response = buildFileUploadResponse([], [`notes.txt: ${result.error}`], []);
        const body = await response.json();
        expect(response.status).toBe(500);
        expect(body).not.toHaveProperty("conflicts");
        const validate = publishedContract("POST", "/api/sandboxes/files", 500);
        expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
      } finally {
        fetchMock.mockRestore();
      }
    },
  );

  it.each([
    {
      name: "conflict-only total failure",
      uploaded: [],
      errors: ["notes.txt: File changed"],
      conflicts: ["notes.txt"],
      status: 409,
    },
    {
      name: "mixed total failure",
      uploaded: [],
      errors: ["notes.txt: File changed", "cover.png: Download failed"],
      conflicts: ["notes.txt"],
      status: 500,
    },
    {
      name: "partial success",
      uploaded: [{ path: "drafts/saved.txt", sha: "b".repeat(40) }],
      errors: ["notes.txt: File changed"],
      conflicts: ["notes.txt"],
      status: 200,
    },
  ])("matches the published schema for $name", async ({ uploaded, errors, conflicts, status }) => {
    const response = buildFileUploadResponse(uploaded, errors, conflicts);
    const body = await response.json();
    expect(response.status).toBe(status);
    const validate = publishedContract("POST", "/api/sandboxes/files", status);
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(body.conflicts).toEqual(conflicts);
    if (status === 200) {
      expect(body.uploaded).toEqual(uploaded);
      expect(body.errors).toEqual(errors);
    }
  });
});
