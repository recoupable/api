import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { trackEmailHandler } from "@/lib/email/trackEmailHandler";
import { loopsClient } from "@/lib/email/loopsClient";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/email/loopsClient", () => ({
  loopsClient: {
    updateContact: vi.fn(),
  },
}));

const buildRequest = (search: string) => new NextRequest(`https://example.com/api/email${search}`);

describe("trackEmailHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { success, message, id } on Loops success", async () => {
    vi.mocked(loopsClient.updateContact).mockResolvedValue({
      success: true,
      id: "contact_123",
      message: "Updated",
    });

    const response = await trackEmailHandler(buildRequest("?email=test%40example.com"));
    const body = await response.json();

    expect(loopsClient.updateContact).toHaveBeenCalledWith("test@example.com", {});
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, message: "Updated", id: "contact_123" });
  });

  it("defaults message and id to empty strings when Loops omits them", async () => {
    vi.mocked(loopsClient.updateContact).mockResolvedValue({ success: true });

    const response = await trackEmailHandler(buildRequest("?email=foo%40bar.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, message: "", id: "" });
  });

  it("returns 400 with { message } when Loops throws", async () => {
    vi.mocked(loopsClient.updateContact).mockRejectedValue(new Error("rate limited"));

    const response = await trackEmailHandler(buildRequest("?email=foo%40bar.com"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: "rate limited" });
  });

  it("returns 400 when email query param is missing", async () => {
    const response = await trackEmailHandler(buildRequest(""));
    expect(response.status).toBe(400);
    expect(loopsClient.updateContact).not.toHaveBeenCalled();
  });
});
