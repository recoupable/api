import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { contextOperationHandler } from "../contextOperationHandler";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { contextToolOperations } from "@/lib/mcp/oauth/contextToolOperations";
import { planStoredContextModules } from "../planning/planStoredContextModules";

// Isolate module initialization from hosted credentials; tests inject or mock authorization.
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: vi.fn() }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(),
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: vi.fn(),
}));

const actor = "00000000-0000-4000-8000-000000000001";
const workspace = "00000000-0000-4000-8000-000000000002";
const request = "00000000-0000-4000-8000-000000000003";
const professional = "00000000-0000-4000-8000-000000000004";
const subject = "00000000-0000-4000-8000-000000000005";
const input = {
  action: "resolve_songwriter_identity",
  organization_id: workspace,
  request_id: request,
  professional_id: professional,
  confirmed: true,
  idempotency_key: "resolve-writer-1",
};
const receipt = {
  resolution: {
    id: "00000000-0000-4000-8000-000000000006",
    request_id: request,
    subject_id: subject,
    professional_id: professional,
    resolved_by: actor,
    resolution_basis: "operator_confirmed",
    created_at: "2026-10-10T00:00:00+00:00",
  },
  created: true,
};
const rpcParams = {
  p_actor: actor,
  p_owner: workspace,
  p_request: request,
  p_professional: professional,
  p_key: "resolve-writer-1",
};
const grant = () =>
  vi.fn(async () => ({ accountId: actor, ownerId: workspace, organizationId: workspace }));

describe("resolve_songwriter_identity", () => {
  it("links the saved request to the explicitly selected professional without dispatch", async () => {
    const rpc = vi.fn(async () => receipt);
    const dispatch = vi.fn();
    const authorize = grant();
    expect(await processContextOperation(actor, input, { rpc, dispatch, authorize })).toEqual(
      receipt,
    );
    expect(authorize).toHaveBeenCalledWith(actor, workspace);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("resolve_context_songwriter_identity", rpcParams);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("returns the stored receipt on an exact replay", async () => {
    const replay = { ...receipt, created: false };
    const rpc = vi.fn(async () => replay);
    expect(
      await processContextOperation(actor, input, { rpc, dispatch: vi.fn(), authorize: grant() }),
    ).toEqual(replay);
  });
  it.each([
    { confirmed: false },
    { confirmed: undefined },
    { confirmed: "yes" },
    { professional_id: undefined },
    { professional_id: "Writer Example" },
    { request_id: undefined },
    { name: "Writer Example" },
    { account_id: actor },
    { roster_intent: "add" },
    { idempotency_key: "" },
  ])("rejects %j before authorization or storage", async patch => {
    const authorize = vi.fn();
    const rpc = vi.fn();
    await expect(
      processContextOperation(actor, { ...input, ...patch }, { rpc, dispatch: vi.fn(), authorize }),
    ).rejects.toThrow();
    expect(authorize).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("never reaches storage when workspace access is revoked", async () => {
    const rpc = vi.fn();
    await expect(
      processContextOperation(actor, input, {
        rpc,
        dispatch: vi.fn(),
        authorize: vi.fn(async () => {
          throw new Error("Access denied to context owner");
        }),
      }),
    ).rejects.toThrow("Access denied to context owner");
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    "Context storage operation failed: Organization access denied",
    "Context storage operation failed: Professional is not in this organization",
    "Context storage operation failed: Request key already used for different input",
    "Context storage operation failed: Songwriter request is already resolved",
  ])("propagates %s once without retrying or rewriting", async message => {
    const rpc = vi.fn(async () => {
      throw new Error(message);
    });
    await expect(
      processContextOperation(actor, input, { rpc, dispatch: vi.fn(), authorize: grant() }),
    ).rejects.toThrow(message);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...receipt, resolution: { ...receipt.resolution, professional_id: subject } },
    { ...receipt, resolution: { ...receipt.resolution, request_id: subject } },
    { ...receipt, resolution: { ...receipt.resolution, resolution_basis: "name_match" } },
    { professional: { id: professional }, created: true },
    null,
  ])("rejects a receipt that does not match the confirmed selection: %j", async stored => {
    const rpc = vi.fn(async () => stored);
    await expect(
      processContextOperation(actor, input, { rpc, dispatch: vi.fn(), authorize: grant() }),
    ).rejects.toThrow();
  });
  it("is a write operation with delegated metadata like every other context action", () => {
    for (const option of contextOperationSchema.options) {
      const action = option.shape.action.value as keyof typeof contextToolOperations;
      expect(contextToolOperations[action]).toBeDefined();
    }
    expect(contextToolOperations.resolve_songwriter_identity.readOnly).toBe(false);
    expect(contextToolOperations.resolve_songwriter_identity.description).toMatch(
      /professional ID/i,
    );
  });
});

describe("resolve_songwriter_identity transports", () => {
  beforeEach(() => {
    vi.mocked(callContextRpc).mockReset();
    vi.mocked(authorizeContextOwner).mockResolvedValue({
      accountId: actor,
      ownerId: workspace,
      organizationId: workspace,
    });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: actor,
      orgId: workspace,
      authToken: "fixture",
    });
    vi.mocked(resolveAccountId).mockResolvedValue({ accountId: actor, error: null });
    vi.mocked(callContextRpc).mockResolvedValue(receipt);
  });
  it("HTTP authenticates the actor and workspace, then calls the shared storage operation", async () => {
    const response = await contextOperationHandler(
      new NextRequest("http://localhost/api/context", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(receipt);
    expect(validateAuthContext).toHaveBeenCalledWith(expect.anything(), {
      organizationId: workspace,
    });
    expect(authorizeContextOwner).toHaveBeenCalledWith(actor, workspace);
    expect(callContextRpc).toHaveBeenCalledExactlyOnceWith(
      "resolve_context_songwriter_identity",
      rpcParams,
    );
  });
  it("HTTP rejects an unconfirmed selection before storage", async () => {
    const response = await contextOperationHandler(
      new NextRequest("http://localhost/api/context", {
        method: "POST",
        body: JSON.stringify({ ...input, confirmed: false }),
      }),
    );
    expect(response.status).toBe(400);
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it("HTTP reports a storage denial without leaking database detail", async () => {
    vi.mocked(callContextRpc).mockRejectedValue(
      new Error("Context storage operation failed: Organization access denied"),
    );
    const response = await contextOperationHandler(
      new NextRequest("http://localhost/api/context", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("Organization access denied");
  });
  it("MCP resolves the same authenticated actor and storage call", async () => {
    const registerTool = vi.fn();
    registerContextTool({ registerTool } as never);
    const result = await registerTool.mock.calls[0][2](input, {});
    expect(resolveAccountId).toHaveBeenCalled();
    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(receipt) }]);
    expect(callContextRpc).toHaveBeenCalledExactlyOnceWith(
      "resolve_context_songwriter_identity",
      rpcParams,
    );
  });
});

describe("resolved songwriter targets", () => {
  it("plan accepts a resolved target and still blocks unimplemented research", async () => {
    vi.mocked(authorizeContextOwner).mockResolvedValue({
      accountId: actor,
      ownerId: workspace,
      organizationId: workspace,
    });
    vi.mocked(callContextRpc).mockImplementation(async name =>
      name === "read_context_request"
        ? { id: request, owner_id: workspace, status: "partial", input: { kind: "songwriter" } }
        : {
            subjectId: subject,
            kind: "songwriter",
            identityConfirmed: true,
            professionalId: professional,
            availableFields: ["submitted_name"],
            reusableModules: [],
          },
    );
    const result = await planStoredContextModules(actor, workspace, request);
    expect(result.collectionPermitted).toBe(false);
    expect(result.plan).toEqual([
      expect.objectContaining({
        module: "songwriter_research",
        state: "not_implemented",
        executionStarted: false,
        reasons: expect.not.arrayContaining([
          "Confirm the target identity before attaching evidence",
        ]),
      }),
    ]);
  });
});
