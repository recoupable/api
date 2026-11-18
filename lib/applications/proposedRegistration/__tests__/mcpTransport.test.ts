import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import golden from "../../../../scripts/application-registration-proposal/receipt-golden.json";
import { fixture } from "../../../../scripts/application-registration-proposal/setup";
import { handleProposedRegistrationMcpRequest as handle } from "@/lib/mcp/applications/handleProposedRegistrationMcpRequest";
import type { ProposedDependencies } from "../proposedRegistrationContract";
import supabase from "@/lib/supabase/serverClient";
import { ProposedStorageFailure } from "../proposedRegistrationContract";
import { createHmac } from "node:crypto";
import { guardProposedRegistrationStorage } from "@/lib/mcp/applications/guardProposedRegistrationStorage";
import { verifyExistingApplicationMcpActor } from "@/lib/mcp/applications/verifyExistingApplicationMcpActor";
import { createProposedRegistrationMcpLifetime } from "@/lib/mcp/applications/createProposedRegistrationMcpLifetime";
import { NextResponse } from "next/server";
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: () => {
    throw new Error("Forbidden provisioning");
  },
}));
const leaves = vi.hoisted(() => ({
  verifyAccess: vi.fn(),
  privyCalls: 0,
  driftAt: 0,
  subject: "synthetic-subject",
}));
vi.mock("@/lib/oauth/getOAuthRuntime", () => ({
  getOAuthRuntime: () => ({ verifyAccess: leaves.verifyAccess }),
}));
vi.mock("@/lib/privy/client", () => ({
  default: {
    utils: () => ({
      auth: () => ({
        verifyAuthToken: async (token: string) => {
          if (token !== "synthetic-privy") throw new Error("PRIVATE_SENTINEL");
          leaves.privyCalls++;
          leaves.subject =
            leaves.privyCalls === leaves.driftAt ? "changed-subject" : "synthetic-subject";
          return { app_id: "synthetic-app", issuer: "privy.io", user_id: leaves.subject };
        },
      }),
    }),
  },
}));
beforeEach(() => {
  vi.stubEnv("OAUTH_ENABLED", "false");
  leaves.verifyAccess.mockReset().mockResolvedValue(undefined);
  leaves.privyCalls = leaves.driftAt = 0;
  leaves.subject = "synthetic-subject";
  fixture.keyId = "22222222-2222-4222-8222-222222222222";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, options?: RequestInit) => {
      expect(url).toBe(`https://api.privy.io/v1/users/${leaves.subject}`);
      expect(options?.method).toBe("GET");
      expect(options?.headers).toEqual({
        "privy-app-id": "synthetic-app",
        Authorization: `Basic ${btoa("synthetic-app:synthetic-registration-secret")}`,
      });
      return {
        ok: true,
        json: async () => ({
          id: leaves.subject,
          linked_accounts: [{ type: "email", address: "fixture@example.invalid" }],
        }),
      };
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const deps = () => ({
  policy: {
    status: "proposed_unadopted",
    version: "proposed-personal-v1",
    databaseHead: golden.databaseHead,
  } as ProposedDependencies["policy"],
  storage: {
    create: vi.fn<ProposedDependencies["storage"]["create"]>(async () =>
      structuredClone(golden.createReceipt),
    ),
    read: vi.fn<ProposedDependencies["storage"]["read"]>(async () =>
      structuredClone(golden.readReceipt),
    ),
  },
});
const input = {
  idempotency_key: golden.input.key,
  expected_entitlement_revision: 1,
  registration: {
    name: golden.input.registration.name,
    environment: "production",
    allowed_origins: golden.input.registration.origins.map(o => o.origin),
    return_urls: golden.input.registration.origins.flatMap(o => o.return_urls),
  },
};
function request(body: unknown, token = fixture.key) {
  return new NextRequest("https://fixture.invalid/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}
it.each(["key", "privy"])(
  "real client initializes, lists and calls shared domains (%s)",
  async mechanism => {
    const d = deps();
    const client = new Client({ name: "synthetic", version: "1" });
    const transport = new StreamableHTTPClientTransport(new URL("https://fixture.invalid/mcp"), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${mechanism === "key" ? fixture.key : "synthetic-privy"}`,
        },
      },
      fetch: async (url, init) =>
        handle(new NextRequest(url instanceof Request ? url : String(url), init), d),
    });
    try {
      await client.connect(transport);
      expect((await client.listTools()).tools.map(t => t.name).sort()).toEqual([
        "create_application_registration",
        "read_application_registration",
      ]);
      const created = await client.callTool({
        name: "create_application_registration",
        arguments: input,
      });
      expect(created.isError).not.toBe(true);
      expect(JSON.stringify(created)).not.toMatch(
        /recoup_sk_|synthetic-privy|verificationEvidence|authToken/,
      );
      expect(d.storage.create).toHaveBeenCalledExactlyOnceWith(golden.input);
      const read = await client.callTool({
        name: "read_application_registration",
        arguments: {
          application_id: golden.readReceipt.application_id,
          environment: "production",
          receipt_id: golden.readReceipt.receipt_id,
        },
      });
      expect(read.isError).not.toBe(true);
      expect(d.storage.read).toHaveBeenCalledTimes(1);
    } finally {
      await client.close();
    }
  },
);
it("denies unknown identity before reading or provisioning during initialize", async () => {
  fixture.accountPresent = false;
  const req = request({ jsonrpc: "2.0", id: 1, method: "initialize" }, "synthetic-privy");
  const reader = vi.spyOn(req.body!, "getReader");
  expect((await handle(req, deps())).status).toBe(401);
  expect(reader).not.toHaveBeenCalled();
});
it.each([
  [],
  [{ jsonrpc: "2.0", id: 1, method: "tools/list" }],
  {
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: "create_application_registration", arguments: input },
  },
])("rejects batch/id-less call before effects", async body => {
  const d = deps();
  expect((await handle(request(body), d)).status).toBe(400);
  expect(d.storage.create).not.toHaveBeenCalled();
});
it("bounds bytes before SDK execution", async () => {
  const r = request("x".repeat(65536));
  expect((await handle(r, deps())).status).toBe(413);
});

function call(name = "create_application_registration", args: unknown = input) {
  return { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name, arguments: args } };
}
it.each(["create", "read"])(
  "rejects key and domain actor drift before original %s storage",
  async operation => {
    for (const [observation, field] of [
      [2, "keyId"],
      [2, "actor"],
      [3, "actor"],
    ] as const) {
      fixture.actor = golden.input.actor;
      fixture.keyId = "22222222-2222-4222-8222-222222222222";
      const original = supabase.from.bind(supabase);
      let seen = 0;
      const spy = vi.spyOn(supabase, "from").mockImplementation(table => {
        if (++seen === observation) fixture[field] = "33333333-3333-4333-8333-333333333333";
        return original(table);
      });
      const d = deps();
      const args =
        operation === "create"
          ? input
          : {
              application_id: golden.readReceipt.application_id,
              environment: "production",
              receipt_id: golden.readReceipt.receipt_id,
            };
      try {
        const response = await handle(
          request(call(`${operation}_application_registration`, args)),
          d,
        );
        expect(response.status).toBe(200);
        expect((await response.json()).result.isError).toBe(true);
        expect(d.storage.create).not.toHaveBeenCalled();
        expect(d.storage.read).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    }
  },
);
it("rejects observed Privy subject drift even when account stays the same", async () => {
  leaves.driftAt = 2;
  const d = deps();
  const response = await handle(request(call(), "synthetic-privy"), d);
  expect((await response.json()).result.isError).toBe(true);
  expect(d.storage.create).not.toHaveBeenCalled();
});
it.each([["mcp:tools"], ["mcp:read"]])(
  "denies delegated %j during initialization",
  async scopes => {
    vi.stubEnv("OAUTH_ENABLED", "true");
    leaves.verifyAccess.mockResolvedValue({
      accountId: fixture.actor,
      scopes,
      grantId: "fixture",
      clientId: "fixture",
      expiresAt: 9999999999,
    });
    const r = request({ jsonrpc: "2.0", id: 1, method: "initialize" });
    const reader = vi.spyOn(r.body!, "getReader");
    expect((await handle(r, deps())).status).toBe(403);
    expect(reader).not.toHaveBeenCalled();
    expect(fixture.queries).toEqual([]);
  },
);
it("classifier failure is bounded without legacy fallback", async () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  leaves.verifyAccess.mockRejectedValue(new Error("PRIVATE_SENTINEL"));
  const response = await handle(request(call()), deps());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE_SENTINEL");
  expect(fixture.queries).toEqual([]);
});
it.each(["denied", "conflict", "outcome_unknown"] as const)(
  "preserves storage %s without retry",
  async kind => {
    const d = deps();
    d.storage.create.mockRejectedValue(new ProposedStorageFailure(kind));
    const result = await (await handle(request(call()), d)).json();
    expect(result.result.isError).toBe(true);
    expect(d.storage.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).toContain(
      kind === "outcome_unknown" ? "Storage outcome unknown" : kind,
    );
  },
);
it("rejects caller identity and altered receipt", async () => {
  const d = deps();
  expect(
    (
      await (
        await handle(
          request(
            call("create_application_registration", {
              ...input,
              actor: fixture.actor,
              policy: d.policy,
            }),
          ),
          d,
        )
      ).json()
    ).result.isError,
  ).toBe(true);
  expect(d.storage.create).not.toHaveBeenCalled();
  d.storage.create.mockResolvedValue({
    ...golden.createReceipt,
    actor: "33333333-3333-4333-8333-333333333333",
  });
  const result = await (await handle(request(call()), d)).json();
  expect(result.result.isError).toBe(true);
  expect(d.storage.create).toHaveBeenCalledTimes(1);
});
it.each([
  ["application/json", "application/json", "{", 406],
  ["text/plain", "application/json, text/event-stream", "{", 415],
  ["application/json", "application/json, text/event-stream", "{", 400],
])("denies malformed headers/body with finite precedence", async (type, accept, body, status) => {
  const r = new NextRequest("https://fixture.invalid/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture.key}`,
      "content-type": String(type),
      accept: String(accept),
    },
    body: String(body),
  });
  expect((await handle(r, deps())).status).toBe(status);
});
it.each([
  ["Application/JSON; charset=utf-8", "Application/JSON, Text/Event-Stream", 200],
  ["application/json;q=custom", "application/json, text/event-stream", 200],
  ["application/json", 'application/json; note="a,b; c", text/event-stream;q=0.5', 200],
  ["text/plain; note=application/json", "application/json, text/event-stream", 415],
  ['text/plain; note="application/json"', "application/json, text/event-stream", 415],
  ["application/json-seq", "application/json, text/event-stream", 415],
  ["application/json", 'text/plain; note="application/json", text/event-stream', 406],
  ["application/json", "application/json;q=0, text/event-stream", 406],
  ["application/json", "application/json, text/event-stream;Q=0.000", 406],
  ["application/json", "application/json;q=0, text/event-stream, */*;q=1", 406],
  ["application/json", "application/json;q=1, application/json;q=0, text/event-stream", 406],
  ["application/json", "application/json;q=1.1, text/event-stream", 406],
  ["application/json", "application/json;q=garbage, text/event-stream", 406],
  ["application/json", "application/json;q=0;q=1, text/event-stream", 406],
  ["application/json", "*/*", 406],
])("validates actual media ranges through the SDK (%s, %s)", async (type, accept, status) => {
  const sdk = vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "handleRequest");
  const d = deps();
  const r = request(call());
  r.headers.set("content-type", String(type));
  r.headers.set("accept", String(accept));
  r.headers.set("mcp-protocol-version", "2025-11-25");
  const before = Object.fromEntries(r.headers);
  const response = await handle(r, d);
  expect(response.status).toBe(status);
  expect(r.headers.get("authorization")).toBe(before.authorization);
  expect(r.headers.get("mcp-protocol-version")).toBe(before["mcp-protocol-version"]);
  expect(d.storage.create).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  if (status === 200) {
    expect((await response.json()).result.isError).not.toBe(true);
    expect(sdk.mock.calls[0][0]).toBe(r);
    expect(r.bodyUsed).toBe(true);
    expect(r.headers.get("accept")).toBe(
      String(accept)
        .replaceAll("Application/JSON", "application/json")
        .replaceAll("Text/Event-Stream", "text/event-stream"),
    );
  } else {
    expect(sdk).not.toHaveBeenCalled();
    expect(Object.fromEntries(r.headers)).toEqual(before);
  }
});
it("accepts exactly 64KiB and counts bytes despite lying length", async () => {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  for (const extra of [0, 1]) {
    const text = body + " ".repeat(65536 - new TextEncoder().encode(body).length + extra);
    const r = new NextRequest("https://fixture.invalid/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${fixture.key}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "content-length": "1",
      },
      body: text,
    });
    expect((await handle(r, deps())).status).toBe(extra ? 413 : 200);
  }
});
it.each([2, 3])(
  "removed credential at observation %s never enters original port",
  async observation => {
    const original = supabase.from.bind(supabase);
    let seen = 0;
    vi.spyOn(supabase, "from").mockImplementation(table => {
      if (++seen === observation) fixture.keyPresent = false;
      return original(table);
    });
    const d = deps();
    const result = await (await handle(request(call()), d)).json();
    expect(result.result.isError).toBe(true);
    expect(d.storage.create).not.toHaveBeenCalled();
  },
);
it("interleaved original requests never share their principal or storage wrapper", async () => {
  const actors = [golden.input.actor, "44444444-4444-4444-8444-444444444444"];
  const keys = ["recoup_sk_one", "recoup_sk_two"];
  const hashes = keys.map(key =>
    createHmac("sha256", "synthetic-registration-secret").update(key).digest("hex"),
  );
  vi.spyOn(supabase, "from").mockImplementation(table => {
    expect(table).toBe("account_api_keys");
    return {
      select(columns: string) {
        expect(columns).toBe("*");
        return {
          eq(field: string, hash: string) {
            expect(field).toBe("key_hash");
            const index = hashes.indexOf(hash);
            expect(index).toBeGreaterThanOrEqual(0);
            return Promise.resolve({
              error: null,
              data: [{ id: actors[index], account: actors[index], expires_at: null }],
            });
          },
        };
      },
    } as ReturnType<typeof supabase.from>;
  });
  const seen: string[] = [];
  let release!: () => void;
  const both = new Promise<void>(resolve => {
    release = resolve;
  });
  const d = deps();
  d.storage.create.mockImplementation(async (arg: unknown) => {
    const actor = (arg as { actor: string }).actor;
    seen.push(actor);
    if (seen.length === 2) release();
    await both;
    return {
      ...structuredClone(golden.createReceipt),
      actor,
      workspace_id: actor,
      billing_owner_id: actor,
      snapshot: { ...structuredClone(golden.createReceipt.snapshot), workspace_id: actor },
    };
  });
  const responses = await Promise.all(keys.map(key => handle(request(call(), key), d)));
  const results = await Promise.all(responses.map(r => r.json()));
  expect(results.every(r => !r.result.isError)).toBe(true);
  expect(seen.sort()).toEqual(actors.sort());
  expect(d.storage.create).toHaveBeenCalledTimes(2);
});
it.each(["denied", "conflict"] as const)("never renders mutable %s exception text", async kind => {
  const d = deps();
  const error = new ProposedStorageFailure(kind);
  error.message = "PRIVATE_SENTINEL token details";
  d.storage.create.mockRejectedValue(error);
  const text = await (await handle(request(call()), d)).text();
  expect(text).not.toContain("PRIVATE_SENTINEL");
  expect(text).toContain(`Proposed storage ${kind}`);
});
it("guard rejects the wrong port method without forwarding observation metadata", async () => {
  const r = request(call());
  const admission = await verifyExistingApplicationMcpActor(r);
  if (admission instanceof NextResponse) throw new Error("Fixture admission failed");
  const d = deps();
  const life = createProposedRegistrationMcpLifetime(r);
  try {
    const wrapped = await guardProposedRegistrationStorage(
      { request: r, admission, dependencies: d, life },
      "create",
      new AbortController().signal,
    );
    expect(() =>
      wrapped.storage.read({
        actor: fixture.actor,
        workspace: fixture.actor,
        application: golden.readReceipt.application_id,
        environment: "production",
        receipt: golden.readReceipt.receipt_id,
      }),
    ).toThrow(ProposedStorageFailure);
    expect(d.storage.read).not.toHaveBeenCalled();
  } finally {
    await life.close();
  }
});
it("counts chunked multibyte wire bytes rather than characters", async () => {
  const source = new TextEncoder().encode(JSON.stringify("音".repeat(23000)));
  const cancel = vi.fn();
  const original = request(call());
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(source.slice(0, 32000));
      c.enqueue(source.slice(32000));
    },
    cancel,
  });
  const r = new NextRequest(original.url, {
    method: "POST",
    headers: original.headers,
    body,
    duplex: "half",
  } as RequestInit);
  expect((await handle(r, deps())).status).toBe(413);
  expect(cancel).toHaveBeenCalledTimes(1);
});
