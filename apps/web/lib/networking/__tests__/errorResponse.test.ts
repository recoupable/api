import { describe, it, expect, vi } from "vitest";
import { errorResponse } from "@/lib/networking/errorResponse";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("errorResponse", () => {
  it("returns { status: 'error', error } at the given HTTP status with CORS headers", async () => {
    const result = errorResponse("Something went wrong", 400);
    const body = await result.json();

    expect(result.status).toBe(400);
    expect(body).toEqual({ status: "error", error: "Something went wrong" });
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
