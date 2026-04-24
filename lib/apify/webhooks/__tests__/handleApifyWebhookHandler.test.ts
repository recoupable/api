import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { handleApifyWebhookHandler } from "../handleApifyWebhookHandler";
import { handleSocialProfileWebhook } from "../socialProfileWebhook/handleSocialProfileWebhook";

vi.mock("../socialProfileWebhook/handleSocialProfileWebhook", () => ({
  handleSocialProfileWebhook: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const validBody = {
  userId: "user_1",
  createdAt: "2026-01-01T00:00:00Z",
  eventType: "ACTOR.RUN.SUCCEEDED",
  eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
  resource: { defaultDatasetId: "dataset_abc" },
};

const buildRequest = (body: unknown, raw = false) =>
  new NextRequest("http://localhost/api/apify/webhooks/socials", {
    method: "POST",
    body: raw ? (body as string) : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("handleApifyWebhookHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await handleApifyWebhookHandler(buildRequest("not-json", true));
    expect(res.status).toBe(400);
  });

  it("returns 400 when payload fails validation", async () => {
    const res = await handleApifyWebhookHandler(buildRequest({ foo: "bar" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with the upserted social on success", async () => {
    const social = { id: "soc_1", username: "x", profile_url: "https://x" };
    vi.mocked(handleSocialProfileWebhook).mockResolvedValue({ social } as never);

    const res = await handleApifyWebhookHandler(buildRequest(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ social });
    expect(handleSocialProfileWebhook).toHaveBeenCalledWith(validBody);
  });

  it("returns 200 with { social: null } when processing throws", async () => {
    vi.mocked(handleSocialProfileWebhook).mockRejectedValue(new Error("boom"));
    const res = await handleApifyWebhookHandler(buildRequest(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ social: null });
  });
});
