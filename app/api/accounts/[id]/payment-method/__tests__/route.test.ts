import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getPaymentMethodHandler } from "@/lib/billing/getPaymentMethodHandler";
import { createPaymentMethodSessionHandler } from "@/lib/billing/createPaymentMethodSessionHandler";
import { deletePaymentMethodHandler } from "@/lib/billing/deletePaymentMethodHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/billing/getPaymentMethodHandler", () => ({ getPaymentMethodHandler: vi.fn() }));
vi.mock("@/lib/billing/createPaymentMethodSessionHandler", () => ({
  createPaymentMethodSessionHandler: vi.fn(),
}));
vi.mock("@/lib/billing/deletePaymentMethodHandler", () => ({
  deletePaymentMethodHandler: vi.fn(),
}));

const { GET, POST, DELETE, OPTIONS } = await import("../route");
const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const ctx = { params: Promise.resolve({ id: ACCOUNT }) };
const req = (method: string) =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/payment-method`, { method });

beforeEach(() => vi.clearAllMocks());

describe("/api/accounts/[id]/payment-method route", () => {
  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("GET delegates to getPaymentMethodHandler", async () => {
    const out = NextResponse.json({});
    vi.mocked(getPaymentMethodHandler).mockResolvedValue(out);
    expect(await GET(req("GET"), ctx)).toBe(out);
  });

  it("POST delegates to createPaymentMethodSessionHandler", async () => {
    const out = NextResponse.json({});
    vi.mocked(createPaymentMethodSessionHandler).mockResolvedValue(out);
    expect(await POST(req("POST"), ctx)).toBe(out);
  });

  it("DELETE delegates to deletePaymentMethodHandler", async () => {
    const out = new NextResponse(null, { status: 204 });
    vi.mocked(deletePaymentMethodHandler).mockResolvedValue(out);
    expect(await DELETE(req("DELETE"), ctx)).toBe(out);
  });
});
