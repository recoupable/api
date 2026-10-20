import { beforeEach, expect, it, vi } from "vitest";
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
const version = "33333333-3333-4333-8333-333333333333";
const cursor = "44444444-4444-4444-8444-444444444444";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId: actor } as never);
  vi.mocked(resolveAccountId).mockResolvedValue({ accountId: actor, error: null });
  vi.mocked(authorizeContextOwner).mockResolvedValue({
    accountId: actor,
    ownerId: owner,
    organizationId: owner,
  });
});
it.each(["http", "combined", "dedicated"])(
  "%s continues after an empty withheld page",
  async transport => {
    const registerTool = vi.fn();
    registerContextTool({ registerTool } as never);
    const read = async (after_id?: string) => {
      const input = {
        source_version_id: version,
        organization_id: owner,
        ...(after_id ? { after_id } : {}),
      };
      if (transport === "http") {
        const response = await contextOperationHandler(
          new NextRequest("http://localhost/api/context", {
            method: "POST",
            body: JSON.stringify({ action: "list_evidence_attachments", ...input }),
          }),
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        return response.json();
      }
      const name = transport === "combined" ? "context" : "list_music_evidence_attachments";
      const callback = registerTool.mock.calls.find(call => call[0] === name)![2];
      const args =
        transport === "combined" ? { action: "list_evidence_attachments", ...input } : input;
      const result = await callback(args, {});
      expect(result.isError).not.toBe(true);
      return JSON.parse(result.content[0].text);
    };
    const withheld = { items: [], next_id: cursor, has_more: true };
    const last = { items: [], next_id: null, has_more: false };
    vi.mocked(callContextRpc).mockResolvedValueOnce(withheld).mockResolvedValueOnce(last);
    const first = await read();
    expect(first).toEqual(withheld);
    expect(await read(first.next_id)).toEqual(last);
    expect(callContextRpc).toHaveBeenNthCalledWith(1, "list_context_evidence_attachments", {
      p_actor: actor,
      p_owner: owner,
      p_version: version,
      p_after: null,
    });
    expect(callContextRpc).toHaveBeenNthCalledWith(2, "list_context_evidence_attachments", {
      p_actor: actor,
      p_owner: owner,
      p_version: version,
      p_after: cursor,
    });
  },
);
