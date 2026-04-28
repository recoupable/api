import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { trackEmailHandler } from "@/lib/email/trackEmailHandler";
import { getLoopsClient } from "@/lib/email/loopsClient";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const updateContactMock = vi.fn();

vi.mock("@/lib/email/loopsClient", () => ({
  getLoopsClient: vi.fn(() => ({
    updateContact: updateContactMock,
  })),
}));

const buildRequest = (search: string) => new NextRequest(`https://example.com/api/email${search}`);

describe("trackEmailHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLoopsClient).mockReturnValue({
      updateContact: updateContactMock,
    } as unknown as ReturnType<typeof getLoopsClient>);
  });

  it("returns { success, message, id } on Loops success", async () => {
    updateContactMock.mockResolvedValue({
      success: true,
      id: "contact_123",
    });

    const response = await trackEmailHandler(buildRequest("?email=test%40example.com"));
    const body = await response.json();

    expect(updateContactMock).toHaveBeenCalledWith({ email: "test@example.com" });
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, message: "", id: "contact_123" });
  });

  it("defaults id to empty string when Loops omits it", async () => {
    updateContactMock.mockResolvedValue({ success: true });

    const response = await trackEmailHandler(buildRequest("?email=foo%40bar.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, message: "", id: "" });
  });

  it("returns 400 with generic message when Loops throws (no raw error leak)", async () => {
    updateContactMock.mockRejectedValue(new Error("rate limited"));

    const response = await trackEmailHandler(buildRequest("?email=foo%40bar.com"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ message: "Internal server error" });
    expect(body.message).not.toContain("rate limited");
  });

  it("returns 400 when email query param is missing", async () => {
    const response = await trackEmailHandler(buildRequest(""));
    expect(response.status).toBe(400);
    expect(updateContactMock).not.toHaveBeenCalled();
  });
});
