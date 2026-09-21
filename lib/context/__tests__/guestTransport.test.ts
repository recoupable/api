import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { guestContextHandler } from "../guest/guestContextHandler";
import { processGuestContext } from "../guest/processGuestContext";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
vi.mock("../guest/processGuestContext", () => ({
  processGuestContext: vi.fn(async () => ({ id: "guest" })),
}));
vi.mock("../guest/dispatchGuestContext", () => ({ dispatchGuestContext: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: "verified" })),
}));
const body = { action: "start", url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB" };
const req = (value = body, headers: Record<string, string> = { origin: "http://localhost" }) =>
  new NextRequest("http://localhost/api/context/guest", {
    method: "POST",
    headers,
    body: JSON.stringify(value),
  });
beforeEach(() => {
  vi.stubEnv("CONTEXT_GUEST_ENABLED", "true");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
describe("guest HTTP capability", () => {
  it("issues HttpOnly session cookie without putting its secret in JSON", async () => {
    const res = await guestContextHandler(req());
    expect(res.status).toBe(202);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await res.json()).toEqual({ id: "guest" });
    expect(validateAuthContext).not.toHaveBeenCalled();
  });
  it("rejects foreign origins before starting work", async () => {
    expect((await guestContextHandler(req(body, { origin: "https://evil.example" }))).status).toBe(
      403,
    );
    expect(processGuestContext).not.toHaveBeenCalled();
  });
  it("fails closed when public guest ingestion is disabled", async () => {
    vi.stubEnv("CONTEXT_GUEST_ENABLED", "false");
    expect((await guestContextHandler(req())).status).toBe(503);
  });
  it("does not create new guest sessions for read or claim", async () => {
    expect(
      (await guestContextHandler(new NextRequest("http://localhost/api/context/guest"))).status,
    ).toBe(401);
    expect((await guestContextHandler(req({ action: "claim" } as never), true)).status).toBe(401);
  });
  it("passes only verified identity into adoption", async () => {
    const res = await guestContextHandler(
      req({ action: "claim" } as never, {
        origin: "http://localhost",
        cookie: `recoup_context_guest=${"a".repeat(64)}`,
      }),
      true,
    );
    expect(res.status).toBe(200);
    expect(processGuestContext).toHaveBeenCalledWith(
      "a".repeat(64),
      { action: "claim" },
      "verified",
      expect.any(Object),
    );
  });
  it("keeps the cookie if dispatch failed after the save", async () => {
    vi.mocked(processGuestContext).mockRejectedValueOnce(Error("dispatch failure"));
    const res = await guestContextHandler(req());
    expect(res.status).toBe(409);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("requires verified login before adoption", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await guestContextHandler(
      req({ action: "claim" } as never, {
        origin: "http://localhost",
        cookie: `recoup_context_guest=${"a".repeat(64)}`,
      }),
      true,
    );
    expect(res.status).toBe(401);
    expect(processGuestContext).not.toHaveBeenCalled();
  });
});

it("starts a fresh guest session after a prior claim or expiration", async () => {
  vi.mocked(callContextRpc).mockResolvedValueOnce(null);
  const response = await guestContextHandler(
    req(body, { origin: "http://localhost", cookie: `recoup_context_guest=${"a".repeat(64)}` }),
  );
  expect(response.status).toBe(202);
  expect(vi.mocked(processGuestContext).mock.calls[0][0]).not.toBe("a".repeat(64));
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});
it("retains an active guest capability for retry", async () => {
  vi.mocked(callContextRpc).mockResolvedValueOnce({ id: "guest" });
  await guestContextHandler(
    req(body, { origin: "http://localhost", cookie: `recoup_context_guest=${"a".repeat(64)}` }),
  );
  expect(vi.mocked(processGuestContext).mock.calls[0][0]).toBe("a".repeat(64));
});
