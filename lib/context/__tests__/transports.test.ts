import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { contextOperationHandler } from "../contextOperationHandler";
import { processContextOperation } from "../processContextOperation";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
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
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("../processContextOperation", async importOriginal => ({
  ...(await importOriginal<typeof import("../processContextOperation")>()),
  processContextOperation: vi.fn(async () => ({ request: { id: "saved" } })),
}));
const body = {
  action: "ingest",
  url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB",
  idempotency_key: "test",
};
describe("Context transports", () => {
  it("HTTP uses authenticated actor and shared operation", async () => {
    const result = await contextOperationHandler(
      new NextRequest("http://localhost/api/context", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    expect(result.status).toBe(202);
    expect(processContextOperation).toHaveBeenCalledWith("actor", body, expect.any(Object));
  });
  it("HTTP rejects caller identity", async () => {
    const result = await contextOperationHandler(
      new NextRequest("http://localhost/api/context", {
        method: "POST",
        body: JSON.stringify({ ...body, account_id: "forged" }),
      }),
    );
    expect(result.status).toBe(400);
  });
  it("HTTP requires authentication", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect(
      (
        await contextOperationHandler(
          new NextRequest("http://localhost/api/context", {
            method: "POST",
            body: JSON.stringify(body),
          }),
        )
      ).status,
    ).toBe(401);
  });
  it("MCP resolves identity and calls the same domain operation", async () => {
    const registerTool = vi.fn();
    registerContextTool({ registerTool } as never);
    const callback = registerTool.mock.calls[0][2];
    await callback(body, {});
    expect(resolveAccountId).toHaveBeenCalled();
    expect(processContextOperation).toHaveBeenCalledWith("actor", body, expect.any(Object));
  });
});
