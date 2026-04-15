import { describe, it, expect, vi } from "vitest";
import { errorResponse } from "@/lib/networking/errorResponse";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("errorResponse", () => {
  it("returns a NextResponse with the given message and status", async () => {
    const result = errorResponse("Something went wrong", 400);
    const body = await result.json();

    expect(result.status).toBe(400);
    expect(body.error).toBe("Something went wrong");
  });

  it("includes CORS headers on the response", () => {
    const result = errorResponse("nope", 429);
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
