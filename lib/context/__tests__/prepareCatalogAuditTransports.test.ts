import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { POST } from "@/app/api/context/route";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";
import { handleContextToolOperation } from "@/lib/mcp/tools/context/handleContextToolOperation";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { readRetainedContextSourceVersions } from "@/lib/supabase/context_source_versions/readRetainedContextSourceVersions";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { compileContextBrief } from "../compileContextBrief";
import { contextToolOperations } from "@/lib/mcp/oauth/contextToolOperations";
import { catalogCaseSnapshotSchema } from "../catalogCaseSnapshotSchema";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("@/lib/supabase/context_source_versions/readRetainedContextSourceVersions", () => ({
  readRetainedContextSourceVersions: vi.fn(),
}));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({
  dispatchContextRequest: vi.fn(() => {
    throw new Error("Unexpected provider dispatch");
  }),
}));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(() => {
    throw new Error("Unexpected provider dispatch");
  }),
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: vi.fn(() => {
    throw new Error("Unexpected provider dispatch");
  }),
}));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const briefId = "33333333-3333-4333-8333-333333333333";
const request = "44444444-4444-4444-8444-444444444444";
const source = "55555555-5555-4555-8555-555555555555";
const document = {
  id: "66666666-6666-4666-8666-666666666666",
  resultId: "77777777-7777-4777-8777-777777777777",
  ownerId: owner,
  subjectId: request,
  topic: "company_input",
  version: 1,
  status: "accepted" as const,
  evidenceKind: "customer_assertion" as const,
  text: "Private customer assertion",
  sourceVersionIds: [source],
  coverage: "partial" as const,
};
const saved = {
  id: briefId,
  created_at: "2026-10-26T00:00:00Z",
  purpose: "company_onboarding",
  state: "saved",
  superseded: false,
  brief: compileContextBrief({
    ownerId: owner,
    requests: [{ id: request, subjectIds: [request] }],
    documents: [document],
    purpose: "company_onboarding",
    maxCharacters: 12000,
  }),
};
const input = { action: "prepare_catalog_audit", brief_id: briefId, organization_id: owner };
const http = (body: unknown = input) =>
  POST(
    new NextRequest("http://localhost/api/context", { method: "POST", body: JSON.stringify(body) }),
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId: actor } as never);
  vi.mocked(resolveAccountId).mockResolvedValue({ accountId: actor, error: null });
  vi.mocked(authorizeContextOwner).mockResolvedValue({
    accountId: actor,
    ownerId: owner,
    organizationId: owner,
  });
  vi.mocked(callContextRpc).mockImplementation(async name => {
    if (name !== "read_context_brief") throw new Error("Unexpected storage write");
    return saved;
  });
  vi.mocked(readRetainedContextSourceVersions).mockResolvedValue([
    { id: source, fingerprint: "a".repeat(64) },
  ]);
});
it("runs actual HTTP and dedicated MCP SDK tools through the same provider-free preparation", async () => {
  const response = await http();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const body = await response.json();
  expect(catalogCaseSnapshotSchema.safeParse(body.snapshot).success).toBe(true);
  const server = new McpServer({ name: "catalog-audit-test", version: "1" });
  registerContextTool(server);
  const client = new Client({ name: "test", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  await client.connect(ct);
  try {
    const { tools } = await client.listTools();
    const tool = tools.find(item => item.name === "prepare_catalog_audit");
    expect(tool?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
    expect(tool?.inputSchema.properties).not.toHaveProperty("action");
    expect(tool?.inputSchema.properties).not.toHaveProperty("account_id");
    const result = await client.callTool({
      name: "prepare_catalog_audit",
      arguments: { brief_id: briefId, organization_id: owner },
    });
    expect(result.isError).not.toBe(true);
    const prepared = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(prepared).toEqual({
      ...body,
      snapshot: { ...body.snapshot, case_id: prepared.snapshot.case_id },
    });
    expect(prepared.snapshot.case_id).not.toBe(body.snapshot.case_id);
    expect(callContextRpc).toHaveBeenCalledTimes(4);
  } finally {
    await client.close();
    await server.close();
  }
});
it("excludes delegated OAuth before any source lookup", async () => {
  expect(contextToolOperations.prepare_catalog_audit).toMatchObject({ delegated: false });
  const result = await handleContextToolOperation(input, {
    authInfo: { extra: { oauth: true } },
  } as never);
  expect(result).toMatchObject({ isError: true });
  expect(callContextRpc).not.toHaveBeenCalled();
  expect(readRetainedContextSourceVersions).not.toHaveBeenCalled();
});
it("requires authentication and valid IDs without exposing evidence", async () => {
  vi.mocked(validateAuthContext).mockResolvedValueOnce(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
  expect((await http()).status).toBe(401);
  expect((await http({ ...input, brief_id: "invalid" })).status).toBe(400);
  expect((await http({ ...input, account_id: actor })).status).toBe(400);
  vi.mocked(resolveAccountId).mockResolvedValueOnce({ accountId: null, error: "Unauthorized" });
  expect(await handleContextToolOperation(input, {} as never)).toMatchObject({ isError: true });
  expect(callContextRpc).not.toHaveBeenCalled();
});
afterEach(() => vi.restoreAllMocks());

it("keeps unknown preparation failures opaque and non-retryable on both transports", async () => {
  vi.mocked(callContextRpc).mockRejectedValue(new Error("Private source and credentials"));
  const response = await http();
  expect(response.status).toBe(500);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const body = await response.json();
  expect(body).toMatchObject({
    code: "internal",
    retryable: false,
    error: "Context operation failed.",
  });
  expect(body.guidance).toContain("Do not automatically retry");
  expect(body.error).not.toMatch(/Private source|ingestion|idempotency/);
  const result = await handleContextToolOperation(input, {} as never);
  expect(result).toMatchObject({ isError: true });
  const mcp = JSON.parse(result.content[0].text);
  expect(mcp).toEqual({
    success: false,
    code: body.code,
    message: body.error,
    retryable: false,
    guidance: body.guidance,
  });
  expect(JSON.stringify([result, vi.mocked(console.error).mock.calls])).not.toContain(
    "Private source",
  );
});

it.each(["superseded", "incomplete", "foreign owner", "manifest", "changed", "metadata"])(
  "keeps real preparation %s rejection opaque without implying retry or saving",
  async mode => {
    const rejected = structuredClone(saved);
    if (mode === "superseded") rejected.superseded = true;
    if (mode === "incomplete") rejected.brief.documents = [];
    if (mode === "foreign owner") rejected.brief.documents[0].ownerId = actor;
    if (mode === "manifest") rejected.brief.input_manifest.documents = [];
    if (mode === "changed") {
      rejected.brief.text = "private-changing-evidence-777";
      rejected.brief.text_characters = rejected.brief.text.length;
    }
    if (mode === "metadata")
      vi.mocked(readRetainedContextSourceVersions).mockRejectedValue(
        new Error("Retained Context sources unavailable", { cause: "private-source-token-888" }),
      );
    vi.mocked(callContextRpc).mockImplementation(async name => {
      expect(name).toBe("read_context_brief");
      if (mode === "metadata") return saved;
      if (mode === "changed" && vi.mocked(callContextRpc).mock.calls.length % 2 === 1) return saved;
      return rejected;
    });
    const response = await http();
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toMatchObject({ code: "internal", retryable: false });
    const result = await handleContextToolOperation(input, {} as never);
    expect(result.isError).toBe(true);
    const mcp = JSON.parse(result.content[0].text);
    expect(mcp).toEqual({
      success: false,
      message: body.error,
      code: body.code,
      retryable: false,
      guidance: body.guidance,
    });
    expect(JSON.stringify([body, result, vi.mocked(console.error).mock.calls])).not.toMatch(
      /private-changing-evidence-777|private-source-token-888|Retained Context sources|Catalog audit|idempotency/,
    );
    if (!["changed", "metadata"].includes(mode))
      expect(readRetainedContextSourceVersions).not.toHaveBeenCalled();
    expect(callContextRpc).toHaveBeenCalledTimes(mode === "changed" ? 4 : 2);
  },
);

it("retains typed permission denial when workspace access changes after metadata reads", async () => {
  vi.mocked(authorizeContextOwner).mockImplementation(async () => {
    if (vi.mocked(authorizeContextOwner).mock.calls.length % 3 === 0)
      throw new Error("Access denied to context owner");
    return { accountId: actor, ownerId: owner, organizationId: owner };
  });
  const response = await http();
  const body = await response.json();
  expect(response.status).toBe(403);
  expect(body).toMatchObject({ code: "permission_denied", retryable: false });
  const result = await handleContextToolOperation(input, {} as never);
  expect(result.isError).toBe(true);
  expect(JSON.parse(result.content[0].text)).toMatchObject({
    code: body.code,
    retryable: false,
    guidance: body.guidance,
  });
  expect(callContextRpc).toHaveBeenCalledTimes(4);
  expect(readRetainedContextSourceVersions).toHaveBeenCalledTimes(2);
});
