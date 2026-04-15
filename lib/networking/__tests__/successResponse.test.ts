import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

import { successResponse } from "../successResponse";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

describe("successResponse", () => {
  it("returns 200 with { status: 'success', ...body } and CORS headers", async () => {
    const res = successResponse({ albums: ["a"] });
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await res.json();
    expect(body).toEqual({ status: "success", albums: ["a"] });
  });
});
