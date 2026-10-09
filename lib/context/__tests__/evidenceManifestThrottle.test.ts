import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/context/evidence/route";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
vi.mock("@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit", () => ({
  consumeOAuthRateLimit: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: actor })),
}));
const actor = "11111111-1111-4111-8111-111111111111";
const request = "22222222-2222-4222-8222-222222222222";
const cursor = "33333333-3333-4333-8333-333333333333";
beforeEach(() => vi.clearAllMocks());
it("shares authenticated actor throttling across cursor and workspace choices", async () => {
  vi.mocked(consumeOAuthRateLimit).mockResolvedValue(23);
  for (const query of ["", `&after_id=${cursor}&organization_id=${cursor}`]) {
    const response = await GET(
      new NextRequest(`http://localhost/api/context/evidence?request_id=${request}${query}`),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("23");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  }
  expect(rpc).not.toHaveBeenCalled();
  const calls = vi.mocked(consumeOAuthRateLimit).mock.calls;
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0]).toEqual([
    expect.stringMatching(/^[a-f0-9]{64}$/),
    [{ key: "111ac3322f9d42a8895a2198dff3a4c27270e564e79e52d05bb52e05fa958728", limit: 120 }],
  ]);
  expect(JSON.stringify(calls)).not.toContain(actor);
});
it("fails closed when shared throttling is unavailable", async () => {
  vi.mocked(consumeOAuthRateLimit).mockRejectedValue(new Error("private limiter error"));
  const response = await GET(
    new NextRequest(`http://localhost/api/context/evidence?request_id=${request}`),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private limiter error");
  expect(rpc).not.toHaveBeenCalled();
});
