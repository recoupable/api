import { describe, expect, it } from "vitest";
import { messageErrorResponse } from "@/lib/networking/messageErrorResponse";

describe("messageErrorResponse", () => {
  it("preserves the authentication message envelope and CORS headers", async () => {
    const response = messageErrorResponse("Unauthorized", 401);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ status: "error", message: "Unauthorized" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
