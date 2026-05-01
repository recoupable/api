import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPrivyUserByEmail } from "@/lib/privy/getPrivyUserByEmail";

/**
 * Builds a fetch mock that always resolves to the given Response.
 *
 * @param response - The Response to return on every fetch call
 * @returns The vi mock function (so callers can assert call args)
 */
function mockFetch(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("getPrivyUserByEmail", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.PRIVY_APP_ID = "test-app-id";
    process.env.PRIVY_PROJECT_SECRET = "test-secret";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("posts to /v1/users/email/address with `address` (not `email`) in the body", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ id: "did:privy:abc", custom_metadata: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await getPrivyUserByEmail("user@example.com");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.privy.io/v1/users/email/address");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(init.body)).toEqual({ address: "user@example.com" });
  });

  it("returns the parsed user object on 200", async () => {
    mockFetch(
      new Response(JSON.stringify({ id: "did:privy:abc", custom_metadata: { foo: "bar" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getPrivyUserByEmail("user@example.com");
    expect(result).toEqual({ id: "did:privy:abc", custom_metadata: { foo: "bar" } });
  });

  it("returns null on 404", async () => {
    mockFetch(new Response("", { status: 404 }));

    const result = await getPrivyUserByEmail("nobody@example.com");
    expect(result).toBeNull();
  });

  it("throws on non-2xx, non-404 responses", async () => {
    mockFetch(new Response("rate limited", { status: 429 }));

    await expect(getPrivyUserByEmail("user@example.com")).rejects.toThrow(/429.*rate limited/);
  });
});
