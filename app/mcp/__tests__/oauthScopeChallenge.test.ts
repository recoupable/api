import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "../route";

const { access, createArtist, listArtists, verify } = vi.hoisted(() => ({
  access: {
    accountId: "alice",
    clientId: "agent",
    grantId: "grant",
    context: "personal",
    resource: "https://api.example/mcp",
    scopes: ["mcp:read"],
    expiresAt: 9999999999,
  },
  createArtist: vi.fn(async () => ({ id: "synthetic-artist" })),
  listArtists: vi.fn(async () => []),
  verify: vi.fn(),
}));
vi.mock("@/lib/mcp/verifyApiKey", () => ({ verifyBearerToken: verify }));
vi.mock("@/lib/oauth/verifyOAuthBearer", () => ({ verifyOAuthBearer: async () => access }));
vi.mock("@/lib/mcp/extension/registerRecoupExtension", () => ({
  registerRecoupExtension: vi.fn(),
}));
vi.mock("@/lib/mcp/oauth/registerFullOAuthTools", () => ({ registerFullOAuthTools: vi.fn() }));
vi.mock("@/lib/mcp/tools", () => ({ registerAllTools: vi.fn() }));
vi.mock("@/lib/mcp/oauth/createFullOAuthToolServices", () => ({
  createFullOAuthToolServices: () => ({ listArtists }),
}));
vi.mock("@/lib/mcp/oauth/createOAuthToolServices", () => ({
  createOAuthToolServices: () => ({
    listArtists,
    createArtist,
    updateArtist: vi.fn(),
    getSocials: vi.fn(),
    getChats: vi.fn(),
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  access.scopes = ["mcp:read"];
  vi.stubEnv("OAUTH_ENABLED", "true");
  vi.stubEnv("OAUTH_ISSUER", "https://api.example/api/oauth");
  verify.mockImplementation(async (_req: Request, token?: string) =>
    token === "synthetic-token"
      ? {
          token,
          clientId: access.clientId,
          scopes: access.scopes,
          extra: { accountId: access.accountId, oauth: access },
        }
      : undefined,
  );
});
afterEach(() => vi.unstubAllEnvs());
function request(name: string, token = "synthetic-token") {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-Forwarded-Host": "untrusted.example",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: name === "create_new_artist" ? { name: "Synthetic artist" } : {} },
    }),
  });
}
it("challenges a read-only connection for the existing write scope before effects", async () => {
  const response = await POST(request("create_new_artist"));
  expect(response.status).toBe(403);
  expect(response.headers.get("WWW-Authenticate")).toBe(
    'Bearer error="insufficient_scope", scope="mcp:write", resource_metadata="https://api.example/.well-known/oauth-protected-resource/mcp"',
  );
  expect(response.headers.get("Access-Control-Expose-Headers")).toContain("WWW-Authenticate");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ error: "insufficient_scope" });
  expect(createArtist).not.toHaveBeenCalled();
});
it("keeps invalid authentication a 401 instead of a scope challenge", async () => {
  const response = await POST(request("create_new_artist", "invalid-synthetic"));
  expect(response.status).toBe(401);
  expect(response.headers.get("WWW-Authenticate")).not.toContain("insufficient_scope");
  expect(createArtist).not.toHaveBeenCalled();
});
it("preserves the request body and executes an already-approved write", async () => {
  access.scopes = ["mcp:read", "mcp:write"];
  const response = await POST(request("create_new_artist"));
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("synthetic-artist");
  expect(createArtist).toHaveBeenCalledExactlyOnceWith("alice", "Synthetic artist");
});
it("challenges a write-only connection for the existing read scope", async () => {
  access.scopes = ["mcp:write"];
  const response = await POST(request("list_artists"));
  expect(response.status).toBe(403);
  expect(response.headers.get("WWW-Authenticate")).toContain('scope="mcp:read"');
  expect(listArtists).not.toHaveBeenCalled();
});
it.each(["get_api_key", "send_email", "__proto__", "constructor"])(
  "does not advertise new authority for excluded or unknown tool %s",
  async name => {
    const response = await POST(request(name));
    expect(response.status).not.toBe(403);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
    expect(createArtist).not.toHaveBeenCalled();
  },
);

it("allows a scoped read without consuming or changing its body", async () => {
  const response = await POST(request("list_artists"));
  expect(response.status).toBe(200);
  await response.text();
  expect(listArtists).toHaveBeenCalledExactlyOnceWith("alice");
  expect(response.headers.get("WWW-Authenticate")).toBeNull();
});
it.each(["full", "first-party"])("does not impose limited scopes on the %s route", async mode => {
  if (mode === "full") access.scopes = ["mcp:tools"];
  else
    verify.mockResolvedValue({
      token: "synthetic-token",
      clientId: "first-party",
      scopes: [],
      extra: { accountId: "alice" },
    });
  const response = await POST(request("create_new_artist"));
  // These unrelated registration paths are stubbed; retain their unknown-tool response.
  expect(response.status).not.toBe(403);
  expect(response.headers.get("WWW-Authenticate")).toBeNull();
  expect(createArtist).not.toHaveBeenCalled();
});
it.each([
  JSON.stringify({ method: "tools/call", params: { name: "create_new_artist" } }),
  JSON.stringify([
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_new_artist" } },
  ]),
])("leaves malformed or unsupported protocol bodies to the transport: %s", async body => {
  const original = request("create_new_artist");
  const response = await POST(
    new Request(original.url, { method: "POST", headers: original.headers, body }),
  );
  expect(response.status).not.toBe(403);
  expect(response.headers.get("WWW-Authenticate")).toBeNull();
  expect(createArtist).not.toHaveBeenCalled();
});

// Bound a broken adapter response without waiting for the suite's five-second timeout.
async function boundedPost(req: Request) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      POST(req),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("MCP response did not settle")), 250);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

it.each(["limited", "full", "first-party"])(
  "returns a finite redacted parse error for %s authenticated malformed JSON",
  async mode => {
    if (mode === "full") access.scopes = ["mcp:tools"];
    if (mode === "first-party")
      verify.mockResolvedValue({
        token: "synthetic-token",
        clientId: "first-party",
        scopes: [],
        extra: { accountId: "alice" },
      });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const original = request("create_new_artist");
      const response = await boundedPost(
        new Request(original.url, {
          method: "POST",
          headers: original.headers,
          body: '{"private":"DO-NOT-ECHO",',
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error: Invalid JSON" },
        id: null,
      });
      expect(response.headers.get("WWW-Authenticate")).toBeNull();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(log).not.toHaveBeenCalled();
      expect(createArtist).not.toHaveBeenCalled();
      expect(listArtists).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  },
);

it("rejects invalid authentication before reading malformed JSON", async () => {
  const original = request("create_new_artist", "invalid");
  const req = new Request(original.url, { method: "POST", headers: original.headers, body: "{" });
  const clone = vi.spyOn(req, "clone");
  const response = await boundedPost(req);
  expect(response.status).toBe(401);
  expect(response.headers.get("WWW-Authenticate")).toContain(
    'resource_metadata="https://api.example/.well-known/oauth-protected-resource/mcp"',
  );
  expect(clone).not.toHaveBeenCalled();
});

it.each(["text/plain", "application/octet-stream"])(
  "preserves non-JSON %s rejection",
  async contentType => {
    const original = request("list_artists");
    original.headers.set("Content-Type", contentType);
    const response = await boundedPost(
      new Request(original.url, { method: "POST", headers: original.headers, body: "{" }),
    );
    expect(response.status).toBe(415);
    expect(listArtists).not.toHaveBeenCalled();
  },
);

it.each(["{}", "{"])("preserves Accept rejection with body %s", async body => {
  const original = request("list_artists");
  original.headers.set("Accept", "application/json");
  const response = await boundedPost(
    new Request(original.url, { method: "POST", headers: original.headers, body }),
  );
  expect(response.status).toBe(406);
  expect(listArtists).not.toHaveBeenCalled();
});

it.each([
  ["null", 400],
  ["42", 400],
  ['{"jsonrpc":"2.0","method":"notifications/initialized"}', 202],
])("keeps transport semantics for valid JSON %s", async (body, status) => {
  const original = request("list_artists");
  const req = new Request(original.url, { method: "POST", headers: original.headers, body });
  const clone = vi.spyOn(req, "clone");
  const response = await boundedPost(req);
  expect(response.status).toBe(status);
  expect(clone).toHaveBeenCalledTimes(1);
  expect(listArtists).not.toHaveBeenCalled();
});
