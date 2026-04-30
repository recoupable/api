import "./routeTestMocks";
import { describe, it, expect } from "vitest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const { OPTIONS } = await import("../route");

describe("OPTIONS /api/subscriptions/sessions", () => {
  it("returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(getCorsHeaders).toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
