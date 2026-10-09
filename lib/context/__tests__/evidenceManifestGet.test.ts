import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, OPTIONS } from "@/app/api/context/evidence/route";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
vi.mock("@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit", () => ({
  consumeOAuthRateLimit: vi.fn(),
}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const request = "22222222-2222-4222-8222-222222222222";
const cursor = "33333333-3333-4333-8333-333333333333";
const page = { owner_id: actor, request_id: request, versions: [], has_more: false, next_id: null };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consumeOAuthRateLimit).mockResolvedValue(0);
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId: actor } as never);
  vi.mocked(authorizeContextOwner).mockResolvedValue({
    accountId: actor,
    ownerId: actor,
    organizationId: null,
  });
  rpc.mockResolvedValue({ data: page, error: null });
});
function get(query = `request_id=${request}`) {
  return GET(new NextRequest(`http://localhost/api/context/evidence?${query}`));
}
it("GET reaches the real bounded RPC adapter and prevents response caching", async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(page);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(rpc).toHaveBeenCalledExactlyOnceWith("list_context_request_evidence_versions", {
    p_actor: actor,
    p_owner: actor,
    p_request: request,
    p_after: null,
  });
});
it.each([
  "",
  "request_id=bad",
  `request_id=${request}&request_id=${request}`,
  `request_id=${request}&account_id=${actor}`,
  `request_id=${request}&action=ingest`,
  `request_id=${request}&after_id=bad`,
])("rejects invalid or ambiguous query %s before authorization", async query => {
  expect((await get(query)).status).toBe(400);
  expect(validateAuthContext).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("uses the exact cursor without triggering collection", async () => {
  expect((await get(`request_id=${request}&after_id=${cursor}`)).status).toBe(200);
  expect(rpc.mock.calls[0][1].p_after).toBe(cursor);
});
it("passes the selected organization to both authorization layers", async () => {
  vi.mocked(authorizeContextOwner).mockResolvedValue({
    accountId: actor,
    ownerId: cursor,
    organizationId: cursor,
  });
  rpc.mockResolvedValue({ data: { ...page, owner_id: cursor }, error: null });
  expect((await get(`request_id=${request}&organization_id=${cursor}`)).status).toBe(200);
  expect(validateAuthContext).toHaveBeenCalledWith(expect.any(NextRequest), {
    organizationId: cursor,
  });
  expect(authorizeContextOwner).toHaveBeenCalledWith(actor, cursor);
  expect(rpc.mock.calls[0][1].p_owner).toBe(cursor);
});
it("supports browser authorization preflight without reading evidence", async () => {
  const response = await OPTIONS();
  expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
  expect(rpc).not.toHaveBeenCalled();
});
it("requires authenticated access", async () => {
  vi.mocked(validateAuthContext).mockResolvedValue(NextResponse.json({}, { status: 401 }));
  expect((await get()).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it("withholds revoked scope and malformed private response data", async () => {
  vi.mocked(authorizeContextOwner).mockRejectedValueOnce(new Error("private revoked member"));
  const denied = await get();
  expect(denied.status).toBe(409);
  expect(await denied.text()).not.toContain("private revoked member");
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: { ...page, secret_content: "private secret" }, error: null });
  const malformed = await get();
  expect(malformed.status).toBe(409);
  expect(await malformed.text()).not.toContain("private secret");
});
