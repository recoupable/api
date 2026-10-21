import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/context/route";
import { handleContextToolOperation } from "@/lib/mcp/tools/context/handleContextToolOperation";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
import { catalogPlanningResponseSchema } from "../catalogPlanningResponseSchema";
import published from "@/lib/contracts/fixtures/context-contract.json";
import { registerFullOAuthTools } from "@/lib/mcp/oauth/registerFullOAuthTools";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  resolve: vi.fn(),
  access: vi.fn(),
  targets: vi.fn(),
  rpc: vi.fn(),
  dispatch: vi.fn(),
  release: vi.fn(),
  tracks: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: mocks.auth }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: mocks.resolve }));
vi.mock("@/lib/mcp/tools", async () => {
  const { registerContextTool } = await import("@/lib/mcp/tools/context/registerContextTool");
  return { registerAllTools: registerContextTool };
});
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: mocks.access,
}));
vi.mock("@/lib/supabase/context_requests/listContextCatalogMemberTargets", () => ({
  listContextCatalogMemberTargets: mocks.targets,
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: mocks.rpc }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: mocks.dispatch }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: mocks.release,
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: mocks.tracks,
}));

const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const request = "00000000-0000-4000-8000-000000000003";
const subject = "00000000-0000-4000-8000-000000000004";
const recording = "00000000-0000-4000-8000-000000000005";
const pairs = [
  ["recording_candidates", "musicbrainz", "collectContextMusicBrainz"],
  ["recording_work_candidates", "mlc_recording", "collectContextMlc:recording"],
  ["platform_metadata", "songstats", "collectContextSongstats"],
] as const;
const input = (module: string) => ({
  action: "plan_catalog_members",
  request_id: request,
  subject_id: subject,
  organization_id: owner,
  module,
  after_isrc: "AAA000000000",
  limit: 20,
});
const page = {
  catalogId: owner,
  catalogSubjectId: subject,
  members: [
    {
      subjectId: recording,
      kind: "recording",
      identityConfirmed: true,
      availableFields: ["isrc"],
      reusableModules: [],
      isrc: "AAA000000001",
    },
  ],
  nextCursor: "AAA000000001",
  hasMore: true,
};
type Extra = Parameters<typeof handleContextToolOperation>[1];
const extra = { authInfo: { extra: { oauth: true } } } as unknown as Extra;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ accountId: actor });
  mocks.resolve.mockResolvedValue({ accountId: actor });
  mocks.access.mockResolvedValue(true);
  mocks.targets.mockResolvedValue(page);
});

async function http(args: unknown) {
  return POST(
    new NextRequest("https://fixture.invalid/api/context", {
      method: "POST",
      body: JSON.stringify(args),
    }),
  );
}
async function mcp(args: unknown): Promise<CallToolResult> {
  return handleContextToolOperation(args, extra);
}
function mcpData(result: CallToolResult) {
  const content = result.content[0];
  expect(content.type).toBe("text");
  if (content.type !== "text") throw new Error("Missing planning response");
  return JSON.parse(content.text);
}
function noDispatch() {
  for (const mock of [mocks.rpc, mocks.dispatch, mocks.release, mocks.tracks])
    expect(mock).not.toHaveBeenCalled();
}

function delegated() {
  type Handler = (args: Record<string, unknown>, extra: Extra) => Promise<CallToolResult>;
  let handler: Handler | undefined;
  const server = {
    registerTool: (
      name: string,
      config: { annotations: { readOnlyHint: boolean } },
      callback: Handler,
    ) => {
      if (name === "plan_music_catalog_research") {
        expect(config.annotations.readOnlyHint).toBe(true);
        handler = callback;
      }
    },
  };
  const access = {
    accountId: actor,
    clientId: "fixture-client",
    grantId: "fixture-grant",
    scopes: ["mcp:tools"],
    expiresAt: 9999999999,
    resource: "https://fixture.invalid/mcp",
    context: "personal" as const,
  };
  const verify = vi.fn().mockResolvedValue(access);
  const prepare = vi.fn(async (_name: string, args: Record<string, unknown>) => args);
  registerFullOAuthTools(
    server as unknown as Parameters<typeof registerFullOAuthTools>[0],
    verify,
    {
      prepare,
      listArtists: vi.fn(),
    },
  );
  expect(handler).toBeDefined();
  const delegatedExtra = {
    authInfo: {
      token: "synthetic-token",
      clientId: access.clientId,
      extra: { accountId: actor, oauth: { grantId: access.grantId } },
    },
  } as unknown as Extra;
  return { handler: handler!, verify, prepare, extra: delegatedExtra };
}

describe("catalog planning aliases through real HTTP and MCP processors", () => {
  it.each(pairs)(
    "delegated %s retains the old %s output after grant checks",
    async (alias, raw) => {
      const tool = delegated();
      const { action: _action, ...args } = input(alias);
      const result = await tool.handler(args, tool.extra);
      expect(result.isError).not.toBe(true);
      const content = result.content[0];
      expect(content.type).toBe("text");
      if (content.type !== "text") throw new Error("Missing planning response");
      expect(JSON.parse(content.text)).toEqual(await (await http(input(raw))).json());
      expect(tool.verify).toHaveBeenCalledWith("synthetic-token");
      expect(tool.prepare).toHaveBeenCalledWith("context", input(alias), actor);
      noDispatch();
    },
  );

  it("delegated aliases cannot bypass revoked grants or missing full-tools scope", async () => {
    const tool = delegated();
    const { action: _action, ...args } = input("recording_candidates");
    tool.verify.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      accountId: actor,
      clientId: "fixture-client",
      grantId: "fixture-grant",
      scopes: [],
    });
    expect((await tool.handler(args, tool.extra)).isError).toBe(true);
    expect((await tool.handler(args, tool.extra)).isError).toBe(true);
    expect(tool.prepare).not.toHaveBeenCalled();
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.targets).not.toHaveBeenCalled();
    noDispatch();
  });

  it("reproduces all published planning examples through HTTP and MCP without dispatch", async () => {
    const names = ["catalogPlanRecording", "catalogPlanWork", "catalogPlanPlatform"] as const;
    expect(published.catalogPlanning.requestExamples.map(example => example.module)).toEqual(
      pairs.map(pair => pair[0]),
    );
    for (const [index, name] of names.entries()) {
      const example = published.catalogPlanning.requestExamples[index];
      const expected = published.catalogPlanning.responseExamples[name];
      mocks.targets.mockResolvedValue(expected.page);
      expect(contextOperationSchema.safeParse(example).success).toBe(true);
      expect(catalogPlanningResponseSchema.parse(expected)).toEqual(expected);
      const response = await http(example);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(expected);
      expect(mcpData(await mcp(example))).toEqual(expected);
    }
    const empty = published.catalogPlanning.responseExamples.catalogPlanEmpty;
    mocks.targets.mockResolvedValue(empty.page);
    expect(catalogPlanningResponseSchema.parse(empty)).toEqual(empty);
    expect(await (await http(published.catalogPlanning.requestExamples[0])).json()).toEqual(empty);
    noDispatch();
  });

  it.each(pairs)("%s preserves the complete %s plan and IDs", async (alias, raw, executor) => {
    const oldResponse = await http(input(raw));
    const aliasResponse = await http(input(alias));
    expect(oldResponse.status).toBe(200);
    expect(aliasResponse.status).toBe(200);
    const old = await oldResponse.json();
    expect(catalogPlanningResponseSchema.parse(old)).toEqual(old);
    expect(await aliasResponse.json()).toEqual(old);
    const result = await mcp(input(alias));
    expect(result.isError).not.toBe(true);
    expect(mcpData(result)).toEqual(old);
    expect(old).toEqual({
      page,
      collectionPermitted: false,
      plan: [
        {
          key: `${recording}:${raw}`,
          entry: "catalog",
          subjectId: recording,
          targetKind: "recording",
          module: raw,
          executor,
          state: "blocked",
          reasons: ["Server collection policy has not permitted this module"],
          dependsOn: [],
          scope: "workspace_private",
          executionStarted: false,
        },
      ],
    });
    expect(mocks.auth).toHaveBeenCalledWith(expect.any(NextRequest), { organizationId: owner });
    expect(mocks.resolve).toHaveBeenCalledWith({
      authInfo: extra.authInfo,
      accountIdOverride: undefined,
    });
    expect(mocks.access).toHaveBeenCalledWith({ accountId: actor, organizationId: owner });
    expect(mocks.targets).toHaveBeenCalledWith(owner, request, subject, "AAA000000000", 20);
    noDispatch();
  });

  it.each(pairs)("%s preserves an empty catalog page", async (alias, raw) => {
    mocks.targets.mockResolvedValue({ ...page, members: [], nextCursor: null, hasMore: false });
    const old = await (await http(input(raw))).json();
    expect(await (await http(input(alias))).json()).toEqual(old);
    expect(old.plan).toEqual([]);
    expect(catalogPlanningResponseSchema.parse(old)).toEqual(old);
    expect(old.collectionPermitted).toBe(false);
    noDispatch();
  });

  it("rejects unknown names and account impersonation before access or dispatch", async () => {
    for (const args of [
      input("unknown"),
      { ...input("recording_candidates"), account_id: owner },
    ]) {
      expect(contextOperationSchema.safeParse(args).success).toBe(false);
      expect((await http(args)).status).toBe(400);
      expect((await mcp(args)).isError).toBe(true);
    }
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.targets).not.toHaveBeenCalled();
    noDispatch();
  });

  it("stops unauthenticated HTTP and MCP calls before catalog access", async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    mocks.resolve.mockResolvedValue({ error: "Unauthorized" });
    expect((await http(input("recording_candidates"))).status).toBe(401);
    expect((await mcp(input("recording_candidates"))).isError).toBe(true);
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.targets).not.toHaveBeenCalled();
    noDispatch();
  });

  it.each(pairs)("%s cannot bypass workspace or current-member checks", async alias => {
    mocks.access.mockResolvedValue(false);
    expect((await http(input(alias))).status).toBe(409);
    expect((await mcp(input(alias))).isError).toBe(true);
    expect(mocks.targets).not.toHaveBeenCalled();
    mocks.access.mockResolvedValue(true);
    mocks.targets.mockRejectedValue(new Error("Catalog membership denied"));
    expect((await http(input(alias))).status).toBe(409);
    expect((await mcp(input(alias))).isError).toBe(true);
    noDispatch();
  });

  it.each(pairs)("%s also normalizes before direct domain planning", async (alias, raw) => {
    const deps = { rpc: mocks.rpc, dispatch: mocks.dispatch };
    expect(await processContextOperation(actor, input(alias), deps)).toEqual(
      await processContextOperation(actor, input(raw), deps),
    );
    noDispatch();
  });
});
