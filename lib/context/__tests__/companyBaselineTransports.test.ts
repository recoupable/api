import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { contextOperationHandler } from "../contextOperationHandler";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { baseline } from "./companyBaselineFixture";
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
const actor = "11111111-1111-4111-8111-111111111111";
const owner = baseline.organization_id;
const input = { action: "read_company_baseline", organization_id: owner };
const http = () =>
  contextOperationHandler(
    new NextRequest("http://localhost/api/context", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
const mcp = () => {
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
  rpc.mockResolvedValue({ data: baseline, error: null });
});
it("HTTP and MCP return the same validated baseline through the actual RPC adapter", async () => {
  const response = await http();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(baseline);
  expect(JSON.parse((await mcp()).content[0].text)).toEqual(baseline);
  expect(rpc).toHaveBeenCalledTimes(2);
  for (const call of rpc.mock.calls)
    expect(call).toEqual([
      "read_context_company_baseline",
      {
        p_actor: actor,
        p_org: owner,
        p_after_artist: null,
        p_after_professional: null,
        p_after_source: null,
      },
    ]);
});
it("neither transport calls storage without authentication", async () => {
  vi.mocked(validateAuthContext).mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
  vi.mocked(resolveAccountId).mockResolvedValue({
    accountId: null,
    error: "Authentication required",
  });
  expect((await http()).status).toBe(401);
  expect(JSON.parse((await mcp()).content[0].text)).toMatchObject({ success: false });
  expect(rpc).not.toHaveBeenCalled();
});
it("neither transport exposes internal database errors or data after a database denial", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private database scope failure" } });
  const response = await http();
  expect(response.status).toBe(409);
  expect(JSON.stringify(await response.json())).not.toContain("private database scope failure");
  const tool = await mcp();
  expect(JSON.parse(tool.content[0].text)).toMatchObject({ success: false });
  expect(tool.content[0].text).not.toContain("private database scope failure");
});
