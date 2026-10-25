import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST as developmentEntitlementHandler } from "@/app/api/context/development/entitlements/route";
import { registerDevelopmentEntitlementTool } from "@/lib/mcp/tools/context/registerDevelopmentEntitlementTool";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { authorizeContextOwner } from "../../authorizeContextOwner";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { isStandardOnlyContextTool } from "@/lib/mcp/oauth/isStandardOnlyContextTool";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111",
  caseId = "22222222-2222-4222-8222-222222222222";
const input = {
  kind: "entitlement_calculation",
  method_version: "catalog-entitlements-v1",
  case_id: caseId,
  expected_revision: 1,
  assessment_id: "a",
};
const terms = JSON.parse(readFileSync(new URL("./oracle/input.json", import.meta.url), "utf8"));
const evidenceIds = [
  "synthetic-contract:section-4",
  "synthetic-statement:row-2",
  "synthetic-contract:section-5",
  "synthetic-reserve:row-1",
  "synthetic-recoupment:page-1",
  "synthetic-approved-cost:row-1",
];
const snapshot = {
  schema_version: 1,
  case_id: caseId,
  workspace_id: actor,
  revision: 1,
  scope: "synthetic",
  sources: {
    s: { id: "s", version: "v1", sha256: "a".repeat(64), locator: "synthetic", status: "active" },
  },
  assessments: {
    a: {
      id: "a",
      stage: "reconcile",
      status: "prepared",
      rule_version: "1",
      source_refs: [{ source_id: "s", version: "v1" }],
      data: {
        entitlement_input: terms,
        entitlement_evidence_bindings: Object.fromEntries(
          evidenceIds.map(id => [id, { source_id: "s", version: "v1" }]),
        ),
      },
    },
  },
  findings: {},
  actions: {},
  attempts: {},
  outcomes: {},
};
const receipt = {
  case_id: caseId,
  revision: 1,
  state: "saved",
  evidence_kind: "customer_assertion",
  snapshot,
  withheld_record_ids: [],
  snapshot_usable_for_save: true,
  external_actions: "unsupported",
  created_at: "2026-10-25T00:00:00Z",
};
function http(body: unknown = input) {
  return developmentEntitlementHandler(
    new NextRequest("http://localhost/api/context/development/entitlements", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}
function register() {
  const registerTool = vi.fn();
  registerDevelopmentEntitlementTool({ registerTool } as never);
  return registerTool;
}
function mcp(body: unknown = input, extra: unknown = {}) {
  return register().mock.calls[0][2](body, extra);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("CATALOG_ENTITLEMENT_DEV", "true");
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId: actor } as never);
  vi.mocked(resolveAccountId).mockResolvedValue({ accountId: actor, error: null });
  vi.mocked(authorizeContextOwner).mockResolvedValue({
    accountId: actor,
    ownerId: actor,
    organizationId: null,
  });
  vi.mocked(callContextRpc).mockResolvedValue(structuredClone(receipt));
});
afterEach(() => vi.unstubAllEnvs());
describe("development entitlement transports", () => {
  it("returns identical evidenced results through both transports without saving", async () => {
    const h = await http();
    expect(h.status).toBe(200);
    expect(h.headers.get("cache-control")).toBe("private, no-store");
    const body = await h.json();
    const result = await mcp();
    expect(JSON.parse(result.content[0].text)).toEqual(body);
    expect(result.isError).not.toBe(true);
    expect(body.persisted).toBe(false);
    expect(body.result.lines[0].expected_amount).toBe("40.002205");
    expect(body.provenance.input_evidence_kind).toBe("customer_assertion");
    expect(callContextRpc).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(callContextRpc).mock.calls.every(([name]) => name === "read_context_catalog_case"),
    ).toBe(true);
    expect(authorizeContextOwner).toHaveBeenCalledTimes(4);
  });
  for (const [env, flag] of [
    ["production", "true"],
    ["development", "false"],
    ["test", "true"],
  ])
    it(`hides discovery and refuses ${env}/${flag}`, async () => {
      vi.stubEnv("NODE_ENV", env);
      vi.stubEnv("CATALOG_ENTITLEMENT_DEV", flag);
      expect(register()).not.toHaveBeenCalled();
      const h = await http();
      expect(h.status).toBe(404);
      expect(h.headers.get("cache-control")).toBe("private, no-store");
      expect(validateAuthContext).not.toHaveBeenCalled();
      expect(callContextRpc).not.toHaveBeenCalled();
    });
  it("does not consume a disabled request body", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("http://localhost/api/context/development/entitlements", {
      method: "POST",
      body: "{}",
    });
    const json = vi.spyOn(request, "json");
    const response = await developmentEntitlementHandler(request);
    expect(response.status).toBe(404);
    expect(json).not.toHaveBeenCalled();
  });
  it("rejects captured tool calls if the flag changes", async () => {
    const handler = register().mock.calls[0][2];
    vi.stubEnv("NODE_ENV", "production");
    const result = await handler(input, {});
    expect(result.isError).toBe(true);
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it("keeps delegated OAuth excluded even in development", async () => {
    expect(isStandardOnlyContextTool("dev_calculate_catalog_entitlements")).toBe(true);
    const r = await mcp(input, { authInfo: { extra: { oauth: {} } } });
    expect(r.isError).toBe(true);
    expect(JSON.parse(r.content[0].text).code).toBe("delegated_oauth_unavailable");
    expect(resolveAccountId).not.toHaveBeenCalled();
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it("normalizes authentication errors and applies no-store", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ secret: "never expose" }, { status: 401 }),
    );
    vi.mocked(resolveAccountId).mockResolvedValue({
      accountId: undefined,
      error: "secret",
    } as never);
    const h = await http();
    expect(h.status).toBe(401);
    expect(h.headers.get("cache-control")).toBe("private, no-store");
    const body = await h.json();
    expect(body).toEqual(JSON.parse((await mcp()).content[0].text));
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it("rejects actor injection and invalid/missing arguments identically", async () => {
    for (const value of [
      null,
      {},
      { ...input, account_id: actor },
      { ...input, method_version: "other" },
    ]) {
      const h = await http(value);
      expect(h.status).toBe(400);
      expect(h.headers.get("cache-control")).toBe("private, no-store");
      expect(await h.json()).toEqual(JSON.parse((await mcp(value)).content[0].text));
    }
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it("uses the same workspace-denial path after authentication", async () => {
    vi.mocked(authorizeContextOwner).mockRejectedValue(new Error("private-membership"));
    const args = { ...input, organization_id: actor };
    const h = await http(args);
    expect(h.status).toBe(409);
    expect(await h.json()).toEqual(JSON.parse((await mcp(args)).content[0].text));
    expect(validateAuthContext).toHaveBeenCalledWith(expect.any(NextRequest));
    expect(authorizeContextOwner).toHaveBeenCalledWith(actor, actor);
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it("normalizes thrown authentication failures without exposing their details", async () => {
    vi.mocked(validateAuthContext).mockRejectedValue(new Error("secret-auth"));
    vi.mocked(resolveAccountId).mockRejectedValue(new Error("secret-auth"));
    const h = await http();
    expect(h.status).toBe(401);
    const body = await h.json();
    expect(body).toEqual(JSON.parse((await mcp()).content[0].text));
    expect(JSON.stringify(body)).not.toContain("secret");
  });
  it("returns no-store for malformed JSON", async () => {
    const h = await developmentEntitlementHandler(
      new NextRequest("http://localhost/api/context/development/entitlements", {
        method: "POST",
        body: "{",
      }),
    );
    expect(h.status).toBe(400);
    expect(h.headers.get("cache-control")).toBe("private, no-store");
    expect(validateAuthContext).not.toHaveBeenCalled();
  });
  it("uses actual SDK discovery and call transport", async () => {
    const server = new McpServer({ name: "dev-test", version: "1" });
    registerDevelopmentEntitlementTool(server);
    const client = new Client({ name: "dev-client", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const list = await client.listTools();
      expect(list.tools.map(t => t.name)).toEqual(["dev_calculate_catalog_entitlements"]);
      const result = await client.callTool({
        name: "dev_calculate_catalog_entitlements",
        arguments: input,
      });
      expect(result.isError).not.toBe(true);
      const body = await (await http()).json();
      expect(JSON.parse((result.content as Array<{ text: string }>)[0].text)).toEqual(body);
      const bad = await client.callTool({
        name: "dev_calculate_catalog_entitlements",
        arguments: { ...input, account_id: actor },
      });
      expect(bad.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
  it("redacts storage errors in both transports", async () => {
    vi.mocked(callContextRpc).mockRejectedValue(new Error("private-locator-secret"));
    const h = await http();
    expect(h.status).toBe(409);
    expect(h.headers.get("cache-control")).toBe("private, no-store");
    const body = await h.json();
    expect(body).toEqual(JSON.parse((await mcp()).content[0].text));
    expect(JSON.stringify(body)).not.toContain("private-locator");
  });
  it("rejects missing and stale sources through both transports", async () => {
    for (const sources of [
      {},
      { s: { ...snapshot.sources.s, status: "withdrawn" } },
      { s: { ...snapshot.sources.s, stale: true } },
    ]) {
      vi.mocked(callContextRpc).mockResolvedValue({
        ...receipt,
        snapshot: { ...snapshot, sources },
      });
      const h = await http();
      expect(h.status).toBe(409);
      expect(await h.json()).toEqual(JSON.parse((await mcp()).content[0].text));
    }
  });
});
