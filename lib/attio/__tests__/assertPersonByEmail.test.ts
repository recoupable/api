import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assertPersonByEmail } from "@/lib/attio/assertPersonByEmail";

describe("assertPersonByEmail", () => {
  beforeEach(() => vi.stubEnv("ATTIO_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("PUT-asserts by email and returns the record id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { id: { record_id: "rec_1" } } }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await assertPersonByEmail({ email_addresses: [{ email_address: "a@b.com" }] });
    expect(res.recordId).toBe("rec_1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.attio.com/v2/objects/people/records?matching_attribute=email_addresses",
    );
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body).data.values.email_addresses).toEqual([
      { email_address: "a@b.com" },
    ]);
  });

  it("returns an error string on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 400 })));
    const res = await assertPersonByEmail({});
    expect(res.recordId).toBeUndefined();
    expect(res.error).toContain("400");
  });
});
