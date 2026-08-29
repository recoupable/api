import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { validateAuthContextMock, claimMock } = vi.hoisted(() => ({
  validateAuthContextMock: vi.fn(),
  claimMock: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: validateAuthContextMock }));
vi.mock("../claimSubscription", () => ({ claimSubscription: claimMock }));

const { claimSubscriptionHandler } = await import("../claimSubscriptionHandler");

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/subscriptions/claim", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer t" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("claimSubscriptionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    validateAuthContextMock.mockResolvedValue({ accountId: "acc_me", orgId: null, authToken: "t" });
  });

  it("returns 200 with the claim result", async () => {
    claimMock.mockResolvedValue({ status: "success", subscription_id: "sub_1", plan: "pro" });
    const res = await claimSubscriptionHandler(req({ session_id: "cs_1" }));
    expect(res.status).toBe(200);
    expect(claimMock).toHaveBeenCalledWith({ sessionId: "cs_1", accountId: "acc_me" });
  });

  it("maps claim errors to 404 / 409 / 400", async () => {
    claimMock.mockResolvedValue({ status: "error", error: "session_not_found" });
    expect((await claimSubscriptionHandler(req({ session_id: "cs_1" }))).status).toBe(404);
    claimMock.mockResolvedValue({ status: "error", error: "already_claimed" });
    expect((await claimSubscriptionHandler(req({ session_id: "cs_1" }))).status).toBe(409);
    claimMock.mockResolvedValue({ status: "error", error: "no_subscription" });
    expect((await claimSubscriptionHandler(req({ session_id: "cs_1" }))).status).toBe(400);
  });

  it("returns 400 without session_id and 401 when auth fails", async () => {
    const bad = await claimSubscriptionHandler(req({}));
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toMatchObject({ status: "error" });

    validateAuthContextMock.mockResolvedValue(
      NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
    );
    expect((await claimSubscriptionHandler(req({ session_id: "cs_1" }))).status).toBe(401);
  });

  it("returns 500 when the claim throws", async () => {
    claimMock.mockRejectedValue(new Error("stripe"));
    expect((await claimSubscriptionHandler(req({ session_id: "cs_1" }))).status).toBe(500);
  });
});
