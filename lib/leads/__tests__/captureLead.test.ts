import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captureLead } from "@/lib/leads/captureLead";
import { assertPersonByEmail } from "@/lib/attio/assertPersonByEmail";
import { createNote } from "@/lib/attio/createNote";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";

vi.mock("@/lib/attio/assertPersonByEmail", () => ({
  assertPersonByEmail: vi.fn().mockResolvedValue({ recordId: "rec-1" }),
}));
vi.mock("@/lib/attio/createNote", () => ({
  createNote: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/telegram/sendSalesNotification", () => ({
  sendSalesNotification: vi.fn().mockResolvedValue(undefined),
}));

const booking = {
  kind: "booking" as const,
  email: "ada@example.com",
  source: "/advisory/book",
  name: "Ada Lovelace",
  company: "Test Co",
  package: "strategy-session",
};

describe("captureLead", () => {
  beforeEach(() => {
    vi.stubEnv("ATTIO_API_KEY", "test-key");
    vi.mocked(assertPersonByEmail).mockClear().mockResolvedValue({ recordId: "rec-1" });
    vi.mocked(createNote).mockClear();
    vi.mocked(sendSalesNotification).mockClear().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asserts the person with the full three-part name shape", async () => {
    await captureLead(booking);
    const values = vi.mocked(assertPersonByEmail).mock.calls[0][0];
    expect(values.email_addresses).toEqual([{ email_address: "ada@example.com" }]);
    expect(values.name).toEqual([
      { first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace" },
    ]);
  });

  it("attaches the Advisory Inquiry note and pages Telegram with the Attio deep link", async () => {
    const result = await captureLead(booking);
    expect(result).toMatchObject({ success: true, notified: true });
    expect(vi.mocked(createNote).mock.calls[0][0]).toMatchObject({
      parentObject: "people",
      parentRecordId: "rec-1",
      title: "Advisory Inquiry: Strategy Session ($2,500)",
    });
    const [{ email, text }] = vi.mocked(sendSalesNotification).mock.calls[0];
    expect(email).toBe("ada@example.com");
    expect(text).toContain("/advisory/book");
    expect(text).toContain("Package: Strategy Session ($2,500)");
    expect(text).toContain("https://app.attio.com/recoup/person/rec-1/overview");
  });

  it("creates no note for a plain subscribe", async () => {
    await captureLead({ kind: "subscribe", email: "a@b.com", source: "blog-cta" });
    expect(createNote).not.toHaveBeenCalled();
    expect(sendSalesNotification).toHaveBeenCalled();
  });

  // The lead was NOT stored — this must fail loudly, not page a human about a
  // lead that does not exist. chat#1800's core architecture decision.
  it("fails loudly on an Attio failure: no note, no page, error returned", async () => {
    vi.mocked(assertPersonByEmail).mockResolvedValueOnce({ error: "assert failed: 400" });
    const result = await captureLead(booking);
    expect(result.success).toBe(false);
    expect(createNote).not.toHaveBeenCalled();
    expect(sendSalesNotification).not.toHaveBeenCalled();
  });

  it("reports notified:false for a test address so verification is assertable over HTTP", async () => {
    const result = await captureLead({ ...booking, email: "sweetmantech@gmail.com" });
    expect(result).toMatchObject({ success: true, notified: false });
  });

  // The lead is already in Attio by this point — a Telegram outage must not
  // turn a stored lead into a visitor-facing error.
  it("still succeeds when the notifier rejects", async () => {
    vi.mocked(sendSalesNotification).mockRejectedValueOnce(new Error("telegram down"));
    const result = await captureLead(booking);
    expect(result.success).toBe(true);
  });

  it("fails when ATTIO_API_KEY is not configured — misconfiguration, not silence", async () => {
    vi.stubEnv("ATTIO_API_KEY", "");
    const result = await captureLead(booking);
    expect(result.success).toBe(false);
    expect(assertPersonByEmail).not.toHaveBeenCalled();
  });
});
