import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { guestContextHandler } from "../guest/guestContextHandler";
import { processGuestContext } from "../guest/processGuestContext";
import { dispatchGuestContext } from "../guest/dispatchGuestContext";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

// Keep the handler, auth-context validation, owner authorization and processor real.
// Only credential/membership lookups and storage/workflow boundaries are mocked.
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({ getApiKeyAccountId: vi.fn() }));
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({ getAuthenticatedAccountId: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../guest/dispatchGuestContext", () => ({ dispatchGuestContext: vi.fn() }));

const account = "11111111-1111-4111-8111-111111111111";
const org = "22222222-2222-4222-8222-222222222222";
const token = "a".repeat(64);
const hash = createHash("sha256").update(token).digest("hex");
const adopted = { requestId: "saved-request", guestId: "existing-guest", reused: false };
const deps = { rpc: callContextRpc, dispatch: dispatchGuestContext, dailyLimit: 100 };
function claim(body: Record<string, unknown> = { action: "claim" }) {
  return guestContextHandler(
    new NextRequest("http://localhost/api/context/guest/claim", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        cookie: `recoup_context_guest=${token}`,
        "x-api-key": "synthetic-fixture-key",
      },
      body: JSON.stringify(body),
    }),
    true,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CONTEXT_GUEST_ENABLED", "true");
  vi.stubEnv("CONTEXT_GUEST_ORIGINS", "http://localhost");
  vi.mocked(getApiKeyAccountId).mockResolvedValue(account);
  vi.mocked(validateOrganizationAccess).mockResolvedValue(true);
  vi.mocked(callContextRpc).mockResolvedValue(adopted);
});
afterEach(() => vi.unstubAllEnvs());

describe("guest adoption through real handler and ownership processing", () => {
  it.each([
    { destination: "personal", body: { action: "claim" }, owner: account },
    { destination: "organization", body: { action: "claim", organization_id: org }, owner: org },
  ])(
    "routes the $destination destination with the authenticated actor",
    async ({ body, owner }) => {
      const response = await claim(body);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(adopted);
      expect(getApiKeyAccountId).toHaveBeenCalledExactlyOnceWith(expect.any(NextRequest));
      expect(callContextRpc).toHaveBeenCalledExactlyOnceWith("adopt_context_guest", {
        p_hash: hash,
        p_actor: account,
        p_owner: owner,
      });
      if (owner === account) expect(validateOrganizationAccess).not.toHaveBeenCalled();
      else
        expect(vi.mocked(validateOrganizationAccess).mock.calls).toEqual([
          [{ accountId: account, organizationId: org }],
          [{ accountId: account, organizationId: org }],
        ]);
      expect(dispatchGuestContext).toHaveBeenCalledExactlyOnceWith(adopted.guestId);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );

  it("rejects denied and malformed destinations before private storage or dispatch", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValueOnce(false);
    await expect(
      processGuestContext(token, { action: "claim", organization_id: org }, account, deps),
    ).rejects.toThrow("Access denied");
    await expect(
      processGuestContext(token, { action: "claim", organization_id: "malformed" }, account, deps),
    ).rejects.toThrow();
    expect(validateOrganizationAccess).toHaveBeenCalledExactlyOnceWith({
      accountId: account,
      organizationId: org,
    });
    expect(callContextRpc).not.toHaveBeenCalled();
    expect(dispatchGuestContext).not.toHaveBeenCalled();
  });

  it("rechecks membership after transport authentication and withholds private denial detail", async () => {
    const canary = "private-membership-canary";
    vi.mocked(validateOrganizationAccess)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error(canary));
    const response = await claim({ action: "claim", organization_id: org });
    expect(response.status).toBe(409);
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain(canary);
    expect(body).not.toContain(org);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(callContextRpc).not.toHaveBeenCalled();
    expect(dispatchGuestContext).not.toHaveBeenCalled();
  });

  it.each(["Guest session expired", "Guest work already claimed"])(
    "handles a mocked %s storage refusal without restarting or replacing the cookie",
    async message => {
      vi.mocked(callContextRpc).mockRejectedValueOnce(new Error(message));
      const response = await claim();
      expect(response.status).toBe(409);
      expect(JSON.stringify(await response.json())).not.toContain(message);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(callContextRpc).toHaveBeenCalledExactlyOnceWith("adopt_context_guest", {
        p_hash: hash,
        p_actor: account,
        p_owner: account,
      });
      expect(dispatchGuestContext).not.toHaveBeenCalled();
    },
  );

  it("retains claim scope and cookie on a mocked replay, dispatching only the existing guest ID", async () => {
    vi.mocked(callContextRpc)
      .mockResolvedValueOnce(adopted)
      .mockResolvedValueOnce({ ...adopted, reused: true });
    const first = await claim();
    const retry = await claim();
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(await first.json()).toEqual(adopted);
    expect(await retry.json()).toEqual({ ...adopted, reused: true });
    expect(first.headers.get("set-cookie")).toBeNull();
    expect(retry.headers.get("set-cookie")).toBeNull();
    expect(vi.mocked(callContextRpc).mock.calls).toEqual([
      ["adopt_context_guest", { p_hash: hash, p_actor: account, p_owner: account }],
      ["adopt_context_guest", { p_hash: hash, p_actor: account, p_owner: account }],
    ]);
    expect(vi.mocked(dispatchGuestContext).mock.calls).toEqual([
      [adopted.guestId],
      [adopted.guestId],
    ]);
  });

  it("honors credential refusal before adoption and leaves the original cookie intact", async () => {
    vi.mocked(getApiKeyAccountId).mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const response = await claim();
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(validateOrganizationAccess).not.toHaveBeenCalled();
    expect(callContextRpc).not.toHaveBeenCalled();
    expect(dispatchGuestContext).not.toHaveBeenCalled();
  });
});
