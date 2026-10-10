import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { contextOperationHandler } from "../contextOperationHandler";
import { processContextOperation } from "../processContextOperation";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: "actor" })),
}));
vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: vi.fn(async () => ({ accountId: "actor", error: null })),
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: vi.fn() }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(),
}));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("../processContextOperation", async importOriginal => ({
  ...(await importOriginal<typeof import("../processContextOperation")>()),
  processContextOperation: vi.fn(async () => ({ state: "found", versions: [] })),
}));
const operation = {
  action: "read_document_history",
  document_id: "11111111-1111-4111-8111-111111111111",
  before_revision: 4,
  limit: 2,
};
it("HTTP and MCP share authenticated read_document_history behavior", async () => {
  const response = await contextOperationHandler(
    new NextRequest("http://localhost/api/context", {
      method: "POST",
      body: JSON.stringify(operation),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ state: "found", versions: [] });
  expect(processContextOperation).toHaveBeenLastCalledWith("actor", operation, expect.any(Object));
  const registerTool = vi.fn();
  registerContextTool({ registerTool } as never);
  vi.mocked(processContextOperation).mockClear();
  await registerTool.mock.calls[0][2](operation, {});
  expect(resolveAccountId).toHaveBeenCalled();
  expect(processContextOperation).toHaveBeenCalledTimes(1);
  expect(processContextOperation).toHaveBeenLastCalledWith("actor", operation, expect.any(Object));
});
it("HTTP rejects a forged caller identity on the lineage read as an identity field", async () => {
  vi.mocked(processContextOperation).mockClear();
  const response = await contextOperationHandler(
    new NextRequest("http://localhost/api/context", {
      method: "POST",
      body: JSON.stringify({ ...operation, account_id: "forged" }),
    }),
  );
  expect(response.status).toBe(400);
  expect((await response.json()).issues).toEqual([
    expect.objectContaining({ code: "unrecognized_keys", keys: ["account_id"] }),
  ]);
  expect(processContextOperation).not.toHaveBeenCalled();
});
