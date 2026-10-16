import { createHash } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { processGuestContext } from "../guest/processGuestContext";
import { guestContextHandler } from "../guest/guestContextHandler";
import { dispatchGuestContext } from "../guest/dispatchGuestContext";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
const ids = vi.hoisted(() => ({
  account: "11111111-1111-4111-8111-111111111111",
  org: "22222222-2222-4222-8222-222222222222",
  token: "a".repeat(64),
}));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(async () => true),
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../guest/dispatchGuestContext", () => ({ dispatchGuestContext: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: ids.account, orgId: null, authToken: "t" })),
}));
const hash = createHash("sha256").update(ids.token).digest("hex");
const adopted = { requestId: "request", guestId: "guest", status: "claimed", reused: false };
type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
const deps = () => ({
  rpc: vi.fn<Rpc>(async () => adopted),
  dispatch: vi.fn<(guestId: string) => Promise<unknown>>(),
  dailyLimit: 100,
});
const claim = (
  body: Record<string, unknown>,
  headers: Record<string, string> = {
    origin: "http://localhost",
    cookie: `recoup_context_guest=${ids.token}`,
  },
) =>
  guestContextHandler(
    new NextRequest("http://localhost/api/context/guest/claim", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    true,
  );
beforeEach(() => {
  vi.stubEnv("CONTEXT_GUEST_ENABLED", "true");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
describe("guest adoption workspace routing", () => {
  it("adopts into the personal workspace when no organization is named", async () => {
    const d = deps();
    const result = await processGuestContext(ids.token, { action: "claim" }, ids.account, d);
    expect(d.rpc).toHaveBeenCalledTimes(1);
    expect(d.rpc).toHaveBeenCalledWith("adopt_context_guest", {
      p_hash: hash,
      p_actor: ids.account,
      p_owner: ids.account,
    });
    expect(validateOrganizationAccess).not.toHaveBeenCalled();
    expect(d.dispatch).toHaveBeenCalledWith("guest");
    expect(result).toEqual(adopted);
  });
  it("routes to a verified organization while the actor stays the signed-in account", async () => {
    const d = deps();
    await processGuestContext(
      ids.token,
      { action: "claim", organization_id: ids.org },
      ids.account,
      d,
    );
    expect(validateOrganizationAccess).toHaveBeenCalledWith({
      accountId: ids.account,
      organizationId: ids.org,
    });
    expect(d.rpc).toHaveBeenCalledWith("adopt_context_guest", {
      p_hash: hash,
      p_actor: ids.account,
      p_owner: ids.org,
    });
    expect(d.dispatch).toHaveBeenCalledWith("guest");
  });
  it("refuses an organization the account cannot access before touching storage", async () => {
    const d = deps();
    vi.mocked(validateOrganizationAccess).mockResolvedValueOnce(false);
    await expect(
      processGuestContext(ids.token, { action: "claim", organization_id: ids.org }, ids.account, d),
    ).rejects.toThrow("Access denied to context owner");
    await expect(
      processGuestContext(
        ids.token,
        { action: "claim", organization_id: "not-a-workspace" },
        ids.account,
        d,
      ),
    ).rejects.toThrow();
    expect(validateOrganizationAccess).toHaveBeenCalledTimes(1);
    expect(d.rpc).not.toHaveBeenCalled();
    expect(d.dispatch).not.toHaveBeenCalled();
  });
  it("propagates expired and already-claimed outcomes without dispatching or restarting", async () => {
    for (const message of ["Guest session expired", "Guest work already claimed"]) {
      const d = deps();
      d.rpc.mockRejectedValueOnce(new Error(`Context storage operation failed: ${message}`));
      await expect(
        processGuestContext(ids.token, { action: "claim" }, ids.account, d),
      ).rejects.toThrow(message);
      expect(d.rpc).toHaveBeenCalledTimes(1);
      expect(d.dispatch).not.toHaveBeenCalled();
    }
  });
  it("keeps repeated adoption idempotent and never starts a second extraction", async () => {
    const d = deps();
    d.rpc.mockResolvedValue({ ...adopted, reused: true });
    const first = await processGuestContext(ids.token, { action: "claim" }, ids.account, d);
    const second = await processGuestContext(ids.token, { action: "claim" }, ids.account, d);
    expect(first).toEqual(second);
    expect(d.rpc.mock.calls.map(([name]) => name)).toEqual([
      "adopt_context_guest",
      "adopt_context_guest",
    ]);
    expect(d.dispatch.mock.calls).toEqual([["guest"], ["guest"]]);
  });
});
describe("guest claim transport", () => {
  it.each<[string, Record<string, string>, string]>([
    ["personal", {}, ids.account],
    ["organization", { organization_id: ids.org }, ids.org],
  ])("passes the %s destination through verified authentication", async (_, extra, owner) => {
    vi.mocked(callContextRpc).mockResolvedValueOnce(adopted);
    const res = await claim({ action: "claim", ...extra });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(adopted);
    expect(validateAuthContext).toHaveBeenCalledWith(expect.any(NextRequest), {
      organizationId: extra.organization_id,
    });
    expect(callContextRpc).toHaveBeenCalledWith("adopt_context_guest", {
      p_hash: hash,
      p_actor: ids.account,
      p_owner: owner,
    });
    expect(dispatchGuestContext).toHaveBeenCalledWith("guest");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("answers an expired or foreign-claimed cookie with 409 and no replacement cookie", async () => {
    for (const message of ["Guest session expired", "Guest work already claimed"]) {
      vi.mocked(callContextRpc).mockRejectedValueOnce(
        new Error(`Context storage operation failed: ${message}`),
      );
      const res = await claim({ action: "claim" });
      expect(res.status).toBe(409);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    expect(dispatchGuestContext).not.toHaveBeenCalled();
    expect(callContextRpc).not.toHaveBeenCalledWith("start_context_guest", expect.anything());
  });
});
