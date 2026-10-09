import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
import { storeContextOriginal } from "@/lib/context/originals/storeContextOriginal";
import { reconcileContextOriginal } from "@/lib/context/originals/reconcileContextOriginal";
import { ContextOriginalNeedsReconciliation } from "@/lib/context/originals/ContextOriginalNeedsReconciliation";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit", () => ({
  consumeOAuthRateLimit: vi.fn(),
}));
vi.mock("@/lib/context/originals/storeContextOriginal", () => ({ storeContextOriginal: vi.fn() }));
vi.mock("@/lib/context/originals/reconcileContextOriginal", () => ({
  reconcileContextOriginal: vi.fn(),
}));
const actor = "11111111-1111-4111-8111-111111111111",
  source = "22222222-2222-4222-8222-222222222222";
function request(
  query = "",
  bytes = new TextEncoder().encode("title,isrc\nSong,TEST123\n"),
  header = "x-api-key",
) {
  return new NextRequest(
    `https://api.test/api/context/originals?sourceId=${source}&idempotencyKey=test-1${query}`,
    {
      method: "POST",
      body: bytes,
      headers: { "content-type": "text/csv", [header]: "credential" },
    },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CONTEXT_ORIGINAL_INTAKE_ENABLED", "true");
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: actor,
    orgId: null,
    authToken: "credential",
  });
  vi.mocked(consumeOAuthRateLimit).mockResolvedValue(0);
  vi.mocked(storeContextOriginal).mockResolvedValue({ status: "registered" } as never);
});
afterEach(() => vi.unstubAllEnvs());
it("disabled by default without body/auth consumption", async () => {
  vi.stubEnv("CONTEXT_ORIGINAL_INTAKE_ENABLED", "");
  expect((await POST(request())).status).toBe(503);
  expect(validateAuthContext).not.toHaveBeenCalled();
});
it.each(["x-api-key", "authorization"])("uses shared auth for %s", async header => {
  const r = request("", undefined, header),
    res = await POST(r);
  expect(res.status).toBe(200);
  expect(validateAuthContext).toHaveBeenCalledWith(r, { organizationId: undefined });
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(consumeOAuthRateLimit).toHaveBeenCalledBefore(vi.mocked(storeContextOriginal));
});
it.each([
  "&account_id=other",
  "&sourceId=" + source,
  "&fileKey=secret",
  "&mode=unknown",
  "&mediaType=text/csv",
])("denies invalid metadata %s", async q => {
  expect((await POST(request(q))).status).toBe(400);
  expect(storeContextOriginal).not.toHaveBeenCalled();
});
it("preserves foreign workspace denial before body read", async () => {
  const r = request("&organizationId=" + source);
  vi.mocked(validateAuthContext).mockResolvedValue(
    NextResponse.json({ error: "denied" }, { status: 403 }),
  );
  expect((await POST(r)).status).toBe(403);
  expect(validateAuthContext).toHaveBeenCalledWith(r, { organizationId: source });
  expect(r.bodyUsed).toBe(false);
  expect(consumeOAuthRateLimit).not.toHaveBeenCalled();
});
it("limiter rejection/outage fail before body consumption", async () => {
  const r = request();
  vi.mocked(consumeOAuthRateLimit).mockResolvedValue(20);
  const res = await POST(r);
  expect(res.status).toBe(429);
  expect(res.headers.get("retry-after")).toBe("20");
  expect(r.bodyUsed).toBe(false);
  vi.mocked(consumeOAuthRateLimit).mockRejectedValue(new Error("secret"));
  const unavailable = await POST(request());
  expect(unavailable.status).toBe(503);
  expect(await unavailable.text()).not.toContain("secret");
});
it("actual overflow prevents storage", async () => {
  expect((await POST(request("", new Uint8Array(4194305)))).status).toBe(400);
  expect(storeContextOriginal).not.toHaveBeenCalled();
});
it("recovery only invokes the no-upload flow", async () => {
  vi.mocked(reconcileContextOriginal).mockResolvedValue({ status: "registered" } as never);
  expect((await POST(request("&mode=reconcile"))).status).toBe(200);
  expect(reconcileContextOriginal).toHaveBeenCalledOnce();
  expect(storeContextOriginal).not.toHaveBeenCalled();
});
it("uncertain save withholds internal cause and IDs", async () => {
  vi.mocked(storeContextOriginal).mockRejectedValue(
    new ContextOriginalNeedsReconciliation(actor, source, "test-1", new Error("secret")),
  );
  const res = await POST(request());
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({
    status: "needs_reconciliation",
    error: "Original outcome requires reconciliation",
  });
});

it("accepts a valid parameterized UTF-8 CSV media header", async () => {
  const r = request();
  r.headers.set("content-type", "Text/CSV; charset=utf-8");
  expect((await POST(r)).status).toBe(200);
  expect(storeContextOriginal).toHaveBeenCalledWith(
    actor,
    actor,
    expect.objectContaining({ mediaType: "text/csv" }),
    expect.anything(),
    r.signal,
  );
});
