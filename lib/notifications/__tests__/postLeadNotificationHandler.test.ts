import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { postLeadNotificationHandler } from "@/lib/notifications/postLeadNotificationHandler";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";

vi.mock("@/lib/telegram/sendSalesNotification", () => ({
  sendSalesNotification: vi.fn().mockResolvedValue(undefined),
}));

const post = (body: unknown, authorization = "Bearer s3cr3t") =>
  new NextRequest("https://api.recoupable.dev/api/notifications/lead", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const lead = {
  email: "ada@example.com",
  source: "/advisory/book",
  name: "Ada Lovelace",
  company: "Test Co",
  role: "Label Owner / GM",
  package: "Retained Advisor ($5,000/mo)",
};

describe("postLeadNotificationHandler", () => {
  const original = process.env.INTERNAL_API_SECRET;

  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "s3cr3t";
    vi.mocked(sendSalesNotification).mockClear();
  });
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = original;
  });

  it("notifies on a valid lead and reports that it did", async () => {
    const response = await postLeadNotificationHandler(post(lead));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "success",
      notified: true,
    });

    const [{ text, email }] = vi.mocked(sendSalesNotification).mock.calls[0];
    expect(email).toBe("ada@example.com");
    expect(text).toContain("Package: Retained Advisor ($5,000/mo)");
    expect(text).toContain("Company: Test Co");
    expect(text).toContain("Role: Label Owner / GM");
  });

  it("reports notified:false for a test address so verification is assertable over HTTP", async () => {
    const response = await postLeadNotificationHandler(
      post({ ...lead, email: "sweetmantech@gmail.com" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ notified: false });
  });

  it("401s without the internal bearer token", async () => {
    const response = await postLeadNotificationHandler(post(lead, "Bearer wrong"));
    expect(response.status).toBe(401);
    expect(sendSalesNotification).not.toHaveBeenCalled();
  });

  it("400s on an invalid body", async () => {
    const response = await postLeadNotificationHandler(post({ email: "nope" }));
    expect(response.status).toBe(400);
    expect(sendSalesNotification).not.toHaveBeenCalled();
  });

  it("400s on a non-JSON body rather than throwing", async () => {
    const request = new NextRequest("https://api.recoupable.dev/api/notifications/lead", {
      method: "POST",
      headers: { authorization: "Bearer s3cr3t" },
      body: "not json",
    });
    expect((await postLeadNotificationHandler(request)).status).toBe(400);
  });

  // A Telegram outage must not make the marketing site think the lead was lost —
  // the lead is already in Attio by the time this is called.
  it("still returns 200 when the notifier itself fails", async () => {
    vi.mocked(sendSalesNotification).mockRejectedValueOnce(new Error("telegram down"));
    const response = await postLeadNotificationHandler(post(lead));
    expect(response.status).toBe(200);
  });

  it("never echoes the internal secret in a response body", async () => {
    const response = await postLeadNotificationHandler(post(lead, "Bearer wrong"));
    expect(JSON.stringify(await response.json())).not.toContain("s3cr3t");
  });
});
