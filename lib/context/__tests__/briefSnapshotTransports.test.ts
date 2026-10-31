import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { contextOperationHandler } from "../contextOperationHandler";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: vi.fn() }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(),
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: vi.fn(),
}));

const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const briefId = "44444444-4444-4444-8444-444444444444";
let revoked = false;
function http(body: unknown) {
  return contextOperationHandler(
    new NextRequest("http://localhost/api/context", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}
function mcp(body: unknown) {
  const registerTool = vi.fn();
  registerContextTool({ registerTool } as never);
  return registerTool.mock.calls[0][2](body, {});
}
beforeEach(() => {
  vi.resetAllMocks();
  revoked = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId: actor } as never);
  vi.mocked(resolveAccountId).mockResolvedValue({ accountId: actor, error: null });
  vi.mocked(authorizeContextOwner).mockImplementation(async () => {
    if (revoked) throw new Error("Access denied: private canary membership");
    return { accountId: actor, ownerId: owner, organizationId: owner };
  });
});
afterEach(() => vi.restoreAllMocks());

it.each(["brief", "save_brief", "read_brief"])(
  "HTTP and MCP withhold %s after revocation inside the real operation",
  async action => {
    vi.mocked(callContextRpc).mockImplementation(async name => {
      if (name === "read_context_request")
        return { id: requestId, owner_id: owner, status: "completed", output: { subjectIds: [] } };
      revoked = true;
      return name === "read_context_documents" ? [] : { text: "private canary snapshot" };
    });
    const input =
      action === "read_brief"
        ? { action, brief_id: briefId, organization_id: owner }
        : {
            action,
            request_id: requestId,
            organization_id: owner,
            purpose: "company_onboarding",
            ...(action === "save_brief" ? { idempotency_key: "revoked" } : {}),
          };
    const response = await http(input);
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("private canary");
    revoked = false;
    const result = await mcp(input);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private canary");
    expect(vi.mocked(callContextRpc).mock.calls.map(([name]) => name)).not.toContain(
      "save_context_brief",
    );
  },
);

it("saves through HTTP and reopens the exact compiled snapshot through MCP", async () => {
  let saved: unknown;
  vi.mocked(callContextRpc).mockImplementation(async (name, params) => {
    expect(params.p_owner).toBe(owner);
    if (name === "read_context_request")
      return { id: requestId, owner_id: owner, status: "completed", output: { subjectIds: [] } };
    if (name === "read_context_documents") return [];
    if (name === "save_context_brief") {
      saved = { id: briefId, state: "saved", brief: params.p_snapshot };
      return saved;
    }
    if (name === "read_context_brief") return saved;
    throw new Error("Unexpected fixture operation");
  });
  const response = await http({
    action: "save_brief",
    request_id: requestId,
    organization_id: owner,
    purpose: "company_onboarding",
    idempotency_key: "save-reopen",
  });
  expect(response.status).toBe(200);
  const output = await response.json();
  expect(output.snapshot.brief.input_manifest.compilerVersion).toBe("context-brief-v1");
  const result = await mcp({ action: "read_brief", brief_id: briefId, organization_id: owner });
  expect(result.isError).not.toBe(true);
  expect(JSON.parse(result.content[0].text)).toEqual(output);
  expect(authorizeContextOwner).toHaveBeenCalledTimes(5);
  expect(authorizeContextOwner).toHaveBeenLastCalledWith(actor, owner);
});
