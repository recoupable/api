import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { expect, it, vi } from "vitest";
import { createOAuthConnectionsHandler } from "../createOAuthConnectionsHandler";

const origin = "https://chat.recoupable.dev";
async function request(
  method: string,
  headers: Record<string, string>,
  path = "/connections",
  failure?: Error,
) {
  const identity = vi.fn(async () => ({ accountId: "verified-account", subject: "privy-subject" }));
  const connections = {
    list: vi.fn(async () => ({ connections: [], truncated: false })),
    revoke: vi.fn(),
  };
  if (failure) connections.list.mockRejectedValue(failure);
  const req = Object.assign(Readable.from([]), { method, headers, url: path }) as IncomingMessage;
  const res = { removeHeader: vi.fn(), setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn() };
  await createOAuthConnectionsHandler({ origin, resolveIdentity: identity, connections })(
    req,
    res as unknown as ServerResponse,
  );
  return { identity, connections, res };
}
it("lists only the verified account, ignoring untrusted account query input", async () => {
  const result = await request(
    "GET",
    { origin, authorization: "Bearer login-token" },
    "/connections?account_id=other",
  );
  expect(result.identity).toHaveBeenCalledWith("login-token");
  expect(result.connections.list).toHaveBeenCalledWith("verified-account");
  expect(result.res.writeHead).toHaveBeenCalledWith(200, expect.anything());
});
it("rejects missing or untrusted origins and missing bearer without touching storage", async () => {
  for (const headers of [
    {},
    { origin: "https://evil.example", authorization: "Bearer login-token" },
    { origin },
  ]) {
    const result = await request("GET", headers);
    expect(result.connections.list).not.toHaveBeenCalled();
    expect(result.connections.revoke).not.toHaveBeenCalled();
  }
});
it("revokes a strictly validated connection using only verified ownership", async () => {
  const id = "a".repeat(64);
  const result = await request(
    "DELETE",
    { origin, authorization: "Bearer login-token" },
    `/connections/${id}`,
  );
  expect(result.connections.revoke).toHaveBeenCalledWith("verified-account", id);
  expect(result.res.writeHead).toHaveBeenCalledWith(204, expect.anything());
  const invalid = await request(
    "DELETE",
    { origin, authorization: "Bearer login-token" },
    "/connections/not-a-hash",
  );
  expect(invalid.connections.revoke).not.toHaveBeenCalled();
  expect(invalid.res.writeHead).toHaveBeenCalledWith(405, expect.anything());
});
it("preflights only the trusted origin without login", async () => {
  const result = await request("OPTIONS", { origin });
  expect(result.res.writeHead).toHaveBeenCalledWith(204, expect.anything());
  expect(result.identity).not.toHaveBeenCalled();
});

it("reports storage failures as unavailable without logging backend details", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await request(
      "GET",
      { origin, authorization: "Bearer login-token" },
      "/connections",
      new Error("secret backend detail"),
    );
    expect(result.res.writeHead).toHaveBeenCalledWith(503, expect.anything());
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret backend detail");
  } finally {
    log.mockRestore();
  }
});
