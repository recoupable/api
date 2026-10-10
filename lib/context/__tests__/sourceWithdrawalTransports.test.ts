import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { contextOperationHandler } from "../contextOperationHandler";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";

const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const request = "33333333-3333-4333-8333-333333333333";
const source = "44444444-4444-4444-8444-444444444444";
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: actor })),
}));
vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: vi.fn(async () => ({ accountId: actor, error: null })),
}));
vi.mock("../authorizeContextOwner", () => ({
  authorizeContextOwner: vi.fn(async () => ({
    accountId: actor,
    ownerId: owner,
    organizationId: owner,
  })),
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: vi.fn() }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(),
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: vi.fn(),
}));
const operation = {
  action: "withdraw_source",
  organization_id: owner,
  request_id: request,
  source_id: source,
};
const params = { p_actor: actor, p_owner: owner, p_request: request, p_source: source };
const receipt = {
  contract_version: "context-source-withdrawal-v1",
  request_id: request,
  source_id: source,
  withdrawn_at: "2026-10-10T12:00:00+00:00",
  already_withdrawn: false,
  affected: { results: 1, documents: 1, request_ids: [request] },
};
const http = (body: unknown) =>
  contextOperationHandler(
    new NextRequest("http://localhost/api/context", { method: "POST", body: JSON.stringify(body) }),
  );
const mcp = async (body: unknown) => {
  const registerTool = vi.fn();
  registerContextTool({ registerTool } as never);
  const result = await registerTool.mock.calls[0][2](body, {});
  return JSON.parse(result.content[0].text);
};

afterEach(() => vi.clearAllMocks());

it("HTTP and MCP withdraw through the same actor-scoped RPC", async () => {
  vi.mocked(callContextRpc).mockResolvedValue(receipt);
  const response = await http(operation);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(receipt);
  expect(callContextRpc).toHaveBeenCalledExactlyOnceWith("withdraw_context_request_source", params);
  vi.mocked(callContextRpc).mockClear();
  expect(await mcp(operation)).toEqual(receipt);
  expect(callContextRpc).toHaveBeenCalledExactlyOnceWith("withdraw_context_request_source", params);
});

it("rejects a withdrawal without a source before any storage call", async () => {
  const { source_id: _omitted, ...incomplete } = operation;
  expect((await http(incomplete)).status).toBe(400);
  expect(callContextRpc).not.toHaveBeenCalled();
});

it("redacts storage failures on both transports", async () => {
  vi.mocked(callContextRpc).mockRejectedValue(
    new Error("Context storage operation failed: Source is not an input of this request"),
  );
  const response = await http(operation);
  expect(response.status).toBe(409);
  expect(JSON.stringify(await response.json())).not.toContain("Source is not an input");
  const result = await mcp(operation);
  expect(result).toMatchObject({ success: false });
  expect(JSON.stringify(result)).not.toContain("Source is not an input");
});
