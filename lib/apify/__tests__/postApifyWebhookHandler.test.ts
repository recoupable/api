import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { postApifyWebhookHandler } from "../postApifyWebhookHandler";
import { handleApifyWebhook } from "../handleApifyWebhook";

vi.mock("../handleApifyWebhook", () => ({ handleApifyWebhook: vi.fn() }));

function makeRequest(body: unknown, raw?: string) {
  return new NextRequest("http://localhost/api/apify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

describe("postApifyWebhookHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with dispatcher result on valid payload", async () => {
    vi.mocked(handleApifyWebhook).mockResolvedValue({ posts: [1, 2] } as never);

    const res = await postApifyWebhookHandler(
      makeRequest({
        userId: "u",
        createdAt: "2026-01-01T00:00:00Z",
        eventType: "ACTOR.RUN.SUCCEEDED",
        eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
        resource: { defaultDatasetId: "ds_1" },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ posts: [1, 2] });
    expect(handleApifyWebhook).toHaveBeenCalledOnce();
  });

  it("returns 200 for invalid payloads so Apify does not retry", async () => {
    const res = await postApifyWebhookHandler(makeRequest({ bogus: true }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Invalid payload");
    expect(handleApifyWebhook).not.toHaveBeenCalled();
  });
});
