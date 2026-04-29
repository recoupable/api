import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { mapToSubscriptionSessionError } from "@/lib/stripe/mapToSubscriptionSessionError";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("mapToSubscriptionSessionError", () => {
  it("prefers `error` string from JSON body", async () => {
    const res = NextResponse.json(
      { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
      { status: 401 },
    );
    const out = await mapToSubscriptionSessionError(res);
    expect(out.status).toBe(401);
    await expect(out.json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
  });

  it("falls back to `message` when `error` is absent", async () => {
    const res = NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    const out = await mapToSubscriptionSessionError(res);
    await expect(out.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
