import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "../route";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
import { readRetainedContextOriginal } from "@/lib/context/originals/readRetainedContextOriginal";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit", () => ({
  consumeOAuthRateLimit: vi.fn(),
}));
vi.mock("@/lib/context/originals/readRetainedContextOriginal", () => ({
  readRetainedContextOriginal: vi.fn(),
}));
vi.mock("@/lib/context/originals/storeContextOriginal", () => ({ storeContextOriginal: vi.fn() }));
vi.mock("@/lib/context/originals/reconcileContextOriginal", () => ({
  reconcileContextOriginal: vi.fn(),
}));
const actor = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const file = new Blob(["title,isrc\nSong,TEST\n"], { type: "text/csv" });
const request = (query = `receiptId=${id}`) =>
  new NextRequest(`https://api.test/api/context/originals?${query}`);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CONTEXT_ORIGINAL_INTAKE_ENABLED", "true");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: actor,
    orgId: null,
    authToken: "credential",
  });
  vi.mocked(consumeOAuthRateLimit).mockResolvedValue(0);
  vi.mocked(readRetainedContextOriginal).mockResolvedValue({
    receipt: { media_type: "text/csv", bytes: file.size } as never,
    file,
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("keeps delivery default disabled", async () => {
  delete process.env.CONTEXT_ORIGINAL_INTAKE_ENABLED;
  expect((await GET(request())).status).toBe(503);
  expect(validateAuthContext).not.toHaveBeenCalled();
});
it.each([
  "receiptId=bad",
  `receiptId=${id}&storage_path=secret`,
  `receiptId=${id}&receiptId=${id}`,
])("denies invalid metadata before auth %s", async query => {
  expect((await GET(request(query))).status).toBe(400);
  expect(validateAuthContext).not.toHaveBeenCalled();
});
it("delivers verified bytes as private attachment with fixed safe filename", async () => {
  const res = await GET(request());
  expect(res.status).toBe(200);
  expect(await res.text()).toBe(await file.text());
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("content-type")).toBe("text/csv");
  expect(res.headers.get("content-disposition")).toBe('attachment; filename="original.csv"');
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(readRetainedContextOriginal).toHaveBeenCalledWith(actor, actor, id, 4194304);
  expect(vi.mocked(validateAuthContext).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(consumeOAuthRateLimit).mock.invocationCallOrder[0],
  );
  expect(vi.mocked(consumeOAuthRateLimit).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(readRetainedContextOriginal).mock.invocationCallOrder[0],
  );
});
it("forwards organization to shared auth and uses authorized owner", async () => {
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: actor,
    orgId: id,
    authToken: "credential",
  });
  await GET(request(`receiptId=${id}&organizationId=${id}`));
  expect(validateAuthContext).toHaveBeenCalledWith(expect.anything(), { organizationId: id });
  expect(readRetainedContextOriginal).toHaveBeenCalledWith(actor, id, id, 4194304);
});
it("preserves private headers on unauthorized reply", async () => {
  vi.mocked(validateAuthContext).mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
  const res = await GET(request());
  expect(res.status).toBe(401);
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(readRetainedContextOriginal).not.toHaveBeenCalled();
});
it("withholds on auth dependency rejection", async () => {
  vi.mocked(validateAuthContext).mockRejectedValue(new Error("private cause"));
  const res = await GET(request());
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain("private cause");
  expect(readRetainedContextOriginal).not.toHaveBeenCalled();
});
it("throttles before lookup with Retry-After", async () => {
  vi.mocked(consumeOAuthRateLimit).mockResolvedValue(60);
  const res = await GET(request());
  expect(res.status).toBe(429);
  expect(res.headers.get("retry-after")).toBe("60");
  expect(readRetainedContextOriginal).not.toHaveBeenCalled();
});
it("fails closed when admission is unavailable", async () => {
  vi.mocked(consumeOAuthRateLimit).mockRejectedValue(new Error("private cause"));
  expect((await GET(request())).status).toBe(503);
  expect(readRetainedContextOriginal).not.toHaveBeenCalled();
});
it("withholds revoked or withdrawn file without returning cause", async () => {
  vi.mocked(readRetainedContextOriginal).mockRejectedValue(new Error("secret path"));
  const res = await GET(request());
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain("secret path");
});
it("withholds oversized bytes even from a changed adapter", async () => {
  vi.mocked(readRetainedContextOriginal).mockResolvedValue({
    receipt: { media_type: "text/csv", bytes: 4194305 } as never,
    file: new Blob([new Uint8Array(4194305)]),
  });
  expect((await GET(request())).status).toBe(503);
});

it("denies range delivery before lookup", async () => {
  const r = request();
  r.headers.set("range", "bytes=0-1");
  expect((await GET(r)).status).toBe(400);
  expect(readRetainedContextOriginal).not.toHaveBeenCalled();
});
it("withholds after disconnect during the reader", async () => {
  const controller = new AbortController();
  const r = new NextRequest(`https://api.test/api/context/originals?receiptId=${id}`, {
    signal: controller.signal,
  });
  vi.mocked(readRetainedContextOriginal).mockImplementationOnce(async () => {
    controller.abort();
    return { receipt: { media_type: "text/csv", bytes: file.size } as never, file };
  });
  expect((await GET(r)).status).toBe(503);
});
