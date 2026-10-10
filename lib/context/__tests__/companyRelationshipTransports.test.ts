import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { contextOperationHandler } from "../contextOperationHandler";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { authorizeContextOwner } from "../authorizeContextOwner";
import {
  listInput,
  listParams,
  recordInput,
  recordParams,
  relationshipActor as actor,
  relationshipOwner as owner,
  relationshipPage,
  relationshipReceipt,
} from "./companyRelationshipFixture";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: vi.fn() }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(),
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: vi.fn(),
}));
const http = (input: unknown) =>
  contextOperationHandler(
    new NextRequest("http://localhost/api/context", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
const mcp = (input: unknown) => {
  const registerTool = vi.fn();
  registerContextTool({ registerTool } as never);
  return registerTool.mock.calls[0][2](input, {});
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: actor,
    orgId: owner,
    authToken: "fixture",
  });
  vi.mocked(resolveAccountId).mockResolvedValue({ accountId: actor, error: null });
  vi.mocked(authorizeContextOwner).mockResolvedValue({
    accountId: actor,
    organizationId: owner,
    ownerId: owner,
  });
});
it.each([
  [recordInput, relationshipReceipt, "record_context_company_relationship", recordParams],
  [listInput, relationshipPage, "list_context_company_relationships", listParams],
])("HTTP and MCP share %j through the actual RPC adapter", async (input, result, name, params) => {
  rpc.mockResolvedValue({ data: result, error: null });
  const response = await http(input);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(result);
  expect(JSON.parse((await mcp(input)).content[0].text)).toEqual(result);
  expect(rpc).toHaveBeenCalledTimes(2);
  for (const call of rpc.mock.calls) expect(call).toEqual([name, params]);
});
it("neither transport calls storage without authentication", async () => {
  vi.mocked(validateAuthContext).mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
  vi.mocked(resolveAccountId).mockResolvedValue({
    accountId: null,
    error: "Authentication required",
  });
  expect((await http(recordInput)).status).toBe(401);
  expect(JSON.parse((await mcp(recordInput)).content[0].text)).toMatchObject({ success: false });
  expect(rpc).not.toHaveBeenCalled();
});
it("neither transport exposes internal database errors after a scoped denial", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private database scope failure" } });
  const response = await http(listInput);
  expect(response.status).toBe(409);
  expect(JSON.stringify(await response.json())).not.toContain("private database scope failure");
  const tool = await mcp(listInput);
  expect(JSON.parse(tool.content[0].text)).toMatchObject({ success: false });
  expect(tool.content[0].text).not.toContain("private database scope failure");
});
