import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { postLeadsHandler } from "@/lib/leads/postLeadsHandler";
import { captureLead } from "@/lib/leads/captureLead";

vi.mock("@/lib/leads/captureLead", () => ({
  captureLead: vi
    .fn()
    .mockResolvedValue({ success: true, notified: true, recordUrl: "https://app.attio.com/x" }),
}));

const post = (body: unknown) =>
  new NextRequest("https://api.recoupable.dev/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const booking = {
  kind: "booking",
  email: "ada@example.com",
  source: "/advisory/book",
  name: "Ada Lovelace",
  package: "strategy-session",
};

describe("postLeadsHandler", () => {
  beforeEach(() => {
    vi.mocked(captureLead)
      .mockClear()
      .mockResolvedValue({ success: true, notified: true, recordUrl: "https://app.attio.com/x" });
  });

  it("200s with notified and the record url when the lead is stored", async () => {
    const response = await postLeadsHandler(post(booking));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "success",
      notified: true,
      record_url: "https://app.attio.com/x",
    });
  });

  // Log-and-return-success is the root cause this whole issue exists to end.
  it("502s when the lead was NOT stored — never a fake success", async () => {
    vi.mocked(captureLead).mockResolvedValueOnce({ success: false, error: "assert failed" });
    const response = await postLeadsHandler(post(booking));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error" });
  });

  it("never echoes the upstream Attio error to the visitor", async () => {
    vi.mocked(captureLead).mockResolvedValueOnce({
      success: false,
      error: "assert failed: 400 — secret internals",
    });
    const response = await postLeadsHandler(post(booking));
    expect(JSON.stringify(await response.json())).not.toContain("secret internals");
  });

  it("400s on an invalid body without calling capture", async () => {
    const response = await postLeadsHandler(post({ kind: "booking", email: "nope" }));
    expect(response.status).toBe(400);
    expect(captureLead).not.toHaveBeenCalled();
  });

  it("400s on a non-JSON body rather than throwing", async () => {
    const request = new NextRequest("https://api.recoupable.dev/api/leads", {
      method: "POST",
      body: "not json",
    });
    expect((await postLeadsHandler(request)).status).toBe(400);
  });
});
