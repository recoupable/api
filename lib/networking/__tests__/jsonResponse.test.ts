import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

import { jsonSuccess, jsonError } from "../jsonResponse";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

describe("jsonSuccess", () => {
  it("returns 200 with { status: 'success', ...body } and CORS headers", async () => {
    const res = jsonSuccess({ albums: ["a"] });
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await res.json();
    expect(body).toEqual({ status: "success", albums: ["a"] });
  });
});

describe("jsonError", () => {
  it("returns the given status with { status: 'error', error } and CORS headers", async () => {
    const res = jsonError(404, "Not found");
    expect(res.status).toBe(404);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "Not found" });
  });
});
