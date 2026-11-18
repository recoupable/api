import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { userInfo } from "node:os";
import net from "node:net";
import http2 from "node:http2";
import dgram from "node:dgram";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { NextRequest, NextResponse } from "next/server";
import { fixture } from "../setup";
import { installOwnedSocketGuard } from "./socket-guard.mjs";
import { createProposedApplicationRegistration as create } from "@/lib/applications/proposedRegistration/createProposedApplicationRegistration";
import { readProposedApplicationRegistration as read } from "@/lib/applications/proposedRegistration/readProposedApplicationRegistration";
import { type ProposedDependencies } from "@/lib/applications/proposedRegistration/proposedRegistrationContract";

import { insertProposedApplicationRegistration } from "@/lib/supabase/application_registration_proposal/insertProposedApplicationRegistration";
import { selectProposedApplicationRegistration } from "@/lib/supabase/application_registration_proposal/selectProposedApplicationRegistration";
import type { ProposedRegistrationSqlClient } from "@/lib/supabase/application_registration_proposal/ProposedRegistrationSqlClient";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { handleProposedRegistrationMcpRequest as handle } from "@/lib/mcp/applications/handleProposedRegistrationMcpRequest";
import supabase from "@/lib/supabase/serverClient";

// The shared auth setup denies all sockets; restore only the prevalidated owned Unix socket.
installOwnedSocketGuard();
const actorA = "11111111-1111-4111-8111-111111111111";
const actorB = "33333333-3333-4333-8333-333333333333";
const socket = process.env.REGISTRATION_QUALIFICATION_SOCKET!;
const connection = {
  host: socket,
  port: 55473,
  user: userInfo().username,
  database: "postgres",
  ssl: false,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
  statement_timeout: 10000,
  application_name: "registration-domain-composition",
};
const sql = new Client(connection); // Controller only: never passed to the helpers.
const runtime = new Client({ ...connection, user: "qualification_registration_client" });
const nativeCompatibility: ProposedRegistrationSqlClient = runtime;
void nativeCompatibility;
let setupQueries = 0;
let runtimeIdentity: unknown;
const calls: Array<{ operation: "create" | "read"; state: string; parameters: number }> = [];
let fixtureQueries = 0;
let dropCommittedResponse = false;
let alterReceipt: ((receipt: Record<string, unknown>) => unknown) | undefined;
let server: { version: string; encoding: string };
const fixtureQuery = async (text: string, values: unknown[] = []) => {
  fixtureQueries++;
  return sql.query(text, values);
};
const observedClient: ProposedRegistrationSqlClient = {
  async query(text, values) {
    const operation = text.includes(".create_registration(") ? "create" : "read";
    expect(text).toBe(
      operation === "create"
        ? "SELECT application_registration_execution_proposal.create_registration($1::uuid,$2::uuid,$3::text,$4::text,$5::bigint,$6::jsonb) AS receipt"
        : "SELECT application_registration_execution_proposal.read_registration($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid) AS receipt",
    );
    const observation: (typeof calls)[number] = {
      operation,
      state: "started",
      parameters: values.length,
    };
    calls.push(observation);
    let result;
    try {
      result = await runtime.query(text, values);
      observation.state = "committed";
    } catch (error) {
      observation.state = (error as { code?: string }).code ?? "unclassified";
      throw error;
    }
    if (dropCommittedResponse && operation === "create") {
      dropCommittedResponse = false;
      observation.state = "committed_response_dropped";
      throw new Error("Synthetic response loss after actual SQL commit");
    }
    if (alterReceipt) result.rows[0].receipt = alterReceipt(result.rows[0].receipt);
    return result;
  },
};
const dependencies: ProposedDependencies = {
  policy: {
    status: "proposed_unadopted",
    version: "proposed-personal-v1",
    databaseHead: "f507a77696f20429f977df9885d6c8c11a5f304b",
  },
  storage: {
    create: call => insertProposedApplicationRegistration(observedClient, call),
    read: call => selectProposedApplicationRegistration(observedClient, call),
  },
};

const input = {
  idempotency_key: "composition-create",
  expected_entitlement_revision: 1,
  registration: {
    name: "Música 音楽",
    environment: "production" as const,
    allowed_origins: ["https://preview.example", "https://music.example"],
    return_urls: ["https://music.example/Z", "https://music.example/%C3%A9"],
  },
};
const request = () =>
  new NextRequest("https://fixture.invalid", { headers: { "x-api-key": fixture.key } });
const oneStorage = async <T>(operation: () => Promise<T>): Promise<T> => {
  const before = calls.length;
  try {
    return await operation();
  } finally {
    expect(calls.length - before).toBe(1);
  }
};
const register = (value: unknown = input) =>
  oneStorage(() => create(request(), value, dependencies));
const select = (receipt: { application_id: string; receipt_id: string }) => ({
  application_id: receipt.application_id,
  receipt_id: receipt.receipt_id,
  environment: "production" as const,
});
const grantRead = async (application: string) =>
  fixtureQuery(
    "INSERT INTO application_registration_proposal.management_entitlements(actor,workspace_id,application_id,environment,operation) VALUES($1::uuid,$1::uuid,$2::uuid,'production','read_registration')",
    [actorA, application],
  );

const registrationState = async () => {
  const tables = ["applications", "environments", "origins", "receipts", "requests"];
  const state: Record<string, unknown[]> = {};
  for (const table of tables) {
    state[table] = (
      await fixtureQuery(
        `SELECT to_jsonb(t) AS row FROM application_registration_proposal.${table} t ORDER BY to_jsonb(t)::text`,
      )
    ).rows.map(value => value.row);
  }
  return state;
};

beforeAll(async () => {
  await sql.connect();
  await runtime.connect();
  await runtime.query("SET ROLE qualification_registration_runtime");
  setupQueries++;
  const identity = await runtime.query("SELECT session_user, current_user");
  setupQueries++;
  runtimeIdentity = identity.rows[0];
  expect(runtimeIdentity).toEqual({
    session_user: "qualification_registration_client",
    current_user: "qualification_registration_runtime",
  });
  const metadata = await fixtureQuery(
    "SELECT current_setting('server_version') AS version,current_setting('server_encoding') AS encoding",
  );
  server = metadata.rows[0];
  expect(server.encoding).toBe("UTF8");
  await fixtureQuery(
    "INSERT INTO public.accounts(id) VALUES($1::uuid),($2::uuid) ON CONFLICT DO NOTHING",
    [actorA, actorB],
  );
});
beforeEach(async () => {
  dropCommittedResponse = false;
  alterReceipt = undefined;
  vi.stubEnv("OAUTH_ENABLED", "false");
  await fixtureQuery("TRUNCATE application_registration_proposal.personal_principals CASCADE");
  await fixtureQuery(
    "INSERT INTO application_registration_proposal.personal_principals(account_id) VALUES($1::uuid),($2::uuid)",
    [actorA, actorB],
  );
  await fixtureQuery(
    "INSERT INTO application_registration_proposal.create_entitlements(actor,workspace_id,environment) SELECT account_id,account_id,e FROM application_registration_proposal.personal_principals CROSS JOIN unnest(ARRAY['production','development']) e",
  );
});
afterAll(async () => {
  await runtime.end();
  await sql.end();
  console.log(
    "COMPOSITION_RECEIPT " +
      JSON.stringify({
        server,
        runtimeIdentity,
        storageCalls: calls,
        fixtureQueries,
        setupQueries,
        activation: false,
      }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("actual domain and helpers to restricted disposable SQL wrappers", () => {
  it("creates disabled canonical rows and returns the unchanged SQL receipt", async () => {
    const receipt = await register();
    const stored = await fixtureQuery(
      "SELECT result FROM application_registration_proposal.receipts WHERE id=$1::uuid",
      [receipt.receipt_id],
    );
    expect(receipt).toEqual(stored.rows[0].result);
    expect(receipt.actor).toBe(actorA);
    expect(receipt.workspace_id).toBe(actorA);
    expect(receipt.billing_owner_id).toBe(actorA);
    expect(receipt.recorded_at).toMatch(/T.*(?:Z|\+00:00)$/);
    expect(receipt.snapshot.return_urls).toEqual([
      "https://music.example/%C3%A9",
      "https://music.example/Z",
    ]);
    const rows = await fixtureQuery(
      'SELECT a.workspace_id,a.billing_owner_id,a.name,e.environment,o.origin,o.return_urls FROM application_registration_proposal.applications a JOIN application_registration_proposal.environments e ON e.workspace_id=a.workspace_id AND e.application_id=a.id JOIN application_registration_proposal.origins o ON o.workspace_id=e.workspace_id AND o.application_id=e.application_id AND o.environment=e.environment ORDER BY o.origin COLLATE "C"',
    );
    expect(rows.rows).toHaveLength(2);
    for (const row of rows.rows)
      expect(row).toMatchObject({
        workspace_id: actorA,
        billing_owner_id: actorA,
        name: "Música 音楽",
        environment: "production",
      });
    expect(rows.rows.map(row => row.origin)).toEqual(receipt.snapshot.allowed_origins);
    expect(
      (
        await fixtureQuery(
          "SELECT count(*)::int AS n FROM application_registration_proposal.management_entitlements",
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("requires explicit named read authority and accepts only input UUID aliases", async () => {
    const receipt = await register();
    await expect(
      oneStorage(() => read(request(), select(receipt), dependencies)),
    ).rejects.toMatchObject({ kind: "denied" });
    await grantRead(receipt.application_id);
    const selected = {
      ...select(receipt),
      application_id: receipt.application_id.toUpperCase(),
      receipt_id: receipt.receipt_id.toUpperCase(),
    };
    expect(await oneStorage(() => read(request(), selected, dependencies))).toEqual(receipt);
  });
  it("denies other actors, environments and receipt selections against actual SQL", async () => {
    const receipt = await register();
    await grantRead(receipt.application_id);
    fixture.actor = actorB;
    await expect(
      oneStorage(() => read(request(), select(receipt), dependencies)),
    ).rejects.toMatchObject({ kind: "denied" });
    fixture.actor = actorA;
    for (const selected of [
      { ...select(receipt), environment: "development" },
      { ...select(receipt), receipt_id: actorB },
    ])
      await expect(oneStorage(() => read(request(), selected, dependencies))).rejects.toMatchObject(
        { kind: "denied" },
      );
    expect(
      (
        await fixtureQuery(
          "SELECT count(*)::int AS n FROM application_registration_proposal.applications",
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("keeps unrelated applications and development/production rows isolated", async () => {
    const first = await register();
    fixture.actor = actorB;
    const second = await register();
    fixture.actor = actorA;
    const development = await register({
      ...input,
      idempotency_key: "development-create",
      registration: { ...input.registration, environment: "development" },
    });
    expect(
      new Set([first.application_id, second.application_id, development.application_id]).size,
    ).toBe(3);
    expect(second.workspace_id).toBe(actorB);
    expect(development.environment).toBe("development");
    const rows = await fixtureQuery(
      "SELECT workspace_id,environment,count(*)::int AS n FROM application_registration_proposal.environments GROUP BY workspace_id,environment",
    );
    expect(rows.rows).toHaveLength(3);
    for (const row of rows.rows) expect(row.n).toBe(1);
  });
  it("recovers an actual committed response only with explicit original-key replay", async () => {
    dropCommittedResponse = true;
    await expect(register()).rejects.toMatchObject({ kind: "outcome_unknown" });
    expect(calls.at(-1)?.state).toBe("committed_response_dropped");
    const original = (
      await fixtureQuery("SELECT result FROM application_registration_proposal.receipts")
    ).rows[0].result;
    const saved = await registrationState();
    expect(await register()).toEqual(original);
    expect(await registrationState()).toEqual(saved);
    expect(
      (
        await fixtureQuery(
          "SELECT count(*)::int AS n FROM application_registration_proposal.applications",
        )
      ).rows[0].n,
    ).toBe(1);
    await expect(
      register({
        ...input,
        registration: { ...input.registration, name: "Changed original intent" },
      }),
    ).rejects.toMatchObject({ kind: "conflict" });
    expect(calls.at(-1)?.state).toBe("P2101");
    expect(await registrationState()).toEqual(saved);
    expect(
      (await fixtureQuery("SELECT result FROM application_registration_proposal.receipts")).rows[0]
        .result,
    ).toEqual(original);
  });
  it("classifies both definite conflict sites without changing original rows", async () => {
    const empty = await registrationState();
    await expect(register({ ...input, expected_entitlement_revision: 2 })).rejects.toMatchObject({
      kind: "conflict",
    });
    expect(calls.at(-1)?.state).toBe("P2101");
    expect(await registrationState()).toEqual(empty);
    const original = await register();
    const saved = await registrationState();
    for (const changed of [
      { ...input, expected_entitlement_revision: 2 },
      { ...input, registration: { ...input.registration, environment: "development" } },
    ]) {
      await expect(register(changed)).rejects.toMatchObject({ kind: "conflict" });
      expect(calls.at(-1)?.state).toBe("P2101");
      expect(await registrationState()).toEqual(saved);
    }
    await fixtureQuery(
      "UPDATE application_registration_proposal.create_entitlements SET revision=2 WHERE actor=$1::uuid",
      [actorA],
    );
    expect(await register()).toEqual(original);
    await expect(
      register({ ...input, idempotency_key: "new-stale-revision" }),
    ).rejects.toMatchObject({ kind: "conflict" });
    expect(calls.at(-1)?.state).toBe("P2101");
    expect(await registrationState()).toEqual(saved);
  });
  it("rechecks SQL authority before replay and read, and fresh auth before storage", async () => {
    const receipt = await register();
    await grantRead(receipt.application_id);
    await fixtureQuery(
      "UPDATE application_registration_proposal.create_entitlements SET enabled=false WHERE actor=$1::uuid",
      [actorA],
    );
    await expect(register()).rejects.toMatchObject({ kind: "denied" });
    const saved = await registrationState();
    await expect(register({ ...input, expected_entitlement_revision: 2 })).rejects.toMatchObject({
      kind: "denied",
    });
    expect(calls.at(-1)?.state).toBe("42501");
    expect(await registrationState()).toEqual(saved);
    await fixtureQuery(
      "UPDATE application_registration_proposal.management_entitlements SET enabled=false WHERE actor=$1::uuid",
      [actorA],
    );
    await expect(
      oneStorage(() => read(request(), select(receipt), dependencies)),
    ).rejects.toMatchObject({ kind: "denied" });
    fixture.keyPresent = false;
    const before = calls.length;
    await expect(create(request(), input, dependencies)).rejects.toBeInstanceOf(NextResponse);
    await expect(read(request(), select(receipt), dependencies)).rejects.toBeInstanceOf(
      NextResponse,
    );
    expect(calls).toHaveLength(before);
  });
  it("runtime cannot bypass wrappers or modify tables or create TEMP objects", async () => {
    for (const statement of [
      "SELECT application_registration_proposal.read_registration(NULL,NULL,NULL,NULL,NULL)",
      "UPDATE application_registration_proposal.applications SET name='forbidden'",
      "CREATE TEMP TABLE forbidden_temp(id int)",
    ]) {
      setupQueries++;
      await expect(runtime.query(statement)).rejects.toMatchObject({ code: "42501" });
    }
  });
  it.each([
    "actor",
    "workspace_id",
    "billing_owner_id",
    "access_activated",
    "snapshot",
    "extra",
    "receipt_id",
  ])("actual helpers preserve domain rejection of a tampered %s receipt", async field => {
    const original = await register();
    await grantRead(original.application_id);
    const saved = await registrationState();
    alterReceipt = receipt => ({
      ...receipt,
      [field]: field === "access_activated" ? true : field === "snapshot" ? {} : actorB,
    });
    if (field !== "receipt_id")
      await expect(register()).rejects.toMatchObject({ kind: "outcome_unknown" });
    await expect(
      oneStorage(() => read(request(), select(original), dependencies)),
    ).rejects.toMatchObject({ kind: "outcome_unknown" });
    expect(await registrationState()).toEqual(saved);
    alterReceipt = undefined;
    expect(await register()).toEqual(original);
  });
  it.each(
    [[0], [0xd800], [0xdc00], [0xd800, 0x61], [0xdc00, 0xd800]].flatMap(units => [
      { field: "key", units },
      { field: "name", units },
    ]),
  )("rejects invalid $field code units $units before any SQL query", async ({ field, units }) => {
    const character = String.fromCharCode(...units);
    expect(
      Array.from({ length: character.length }, (_, index) => character.charCodeAt(index)),
    ).toEqual(units);
    const value =
      field === "key"
        ? { ...input, idempotency_key: `req-${character}` }
        : { ...input, registration: { ...input.registration, name: `Name${character}` } };
    const before = calls.length;
    await expect(create(request(), value, dependencies)).rejects.toMatchObject({
      name: "ZodError",
    });
    expect(calls).toHaveLength(before);
  });
  it("preserves valid Unicode keys and distinguishes replay from another valid key", async () => {
    const pair = String.fromCharCode(0xd83d, 0xde80);
    const replacement = String.fromCharCode(0xfffd);
    expect(pair.codePointAt(0)).toBe(0x1f680);
    expect(replacement.codePointAt(0)).toBe(0xfffd);
    const firstInput = {
      ...input,
      idempotency_key: ` key-${pair} `,
      registration: { ...input.registration, name: `  Name${pair}${replacement}  ` },
    };
    const first = await register(firstInput);
    expect(first.snapshot.name).toBe(`Name${pair}${replacement}`);
    const saved = await registrationState();
    expect(await register(firstInput)).toEqual(first);
    expect(await registrationState()).toEqual(saved);
    const second = await register({ ...firstInput, idempotency_key: ` key-${replacement} ` });
    expect(second.application_id).not.toBe(first.application_id);
    const keys = await fixtureQuery(
      'SELECT key FROM application_registration_proposal.requests ORDER BY key COLLATE "C"',
    );
    expect(keys.rows.map(row => row.key).sort()).toEqual(
      [firstInput.idempotency_key, ` key-${replacement} `].sort(),
    );
  });
  it("real MCP SDK create/read reaches the restricted SQL wrappers", async () => {
    const client = new McpClient({ name: "synthetic-sql-composition", version: "1" });
    const transport = new StreamableHTTPClientTransport(new URL("https://fixture.invalid/mcp"), {
      requestInit: { headers: { Authorization: `Bearer ${fixture.key}` } },
      fetch: async (url, init) =>
        handle(new NextRequest(url instanceof Request ? url : String(url), init), dependencies),
    });
    try {
      await client.connect(transport);
      for (const units of [[0], [0xd800], [0xdc00], [0xd800, 0x61], [0xdc00, 0xd800]]) {
        const character = String.fromCharCode(...units);
        expect(
          Array.from({ length: character.length }, (_, index) => character.charCodeAt(index)),
        ).toEqual(units);
        for (const value of [
          { ...input, idempotency_key: `req-${character}` },
          { ...input, registration: { ...input.registration, name: `Name${character}` } },
        ]) {
          const before = calls.length;
          const rejected = await client.callTool({
            name: "create_application_registration",
            arguments: value,
          });
          expect(rejected.isError).toBe(true);
          expect(calls).toHaveLength(before);
        }
      }
      const literalUnits = [0x5c, 0x75, 0x30, 0x30, 0x30, 0x30, 0x5c, 0x75, 0x44, 0x38, 0x30, 0x30];
      const literal = String.fromCharCode(...literalUnits);
      expect(
        Array.from({ length: literal.length }, (_, index) => literal.charCodeAt(index)),
      ).toEqual(literalUnits);
      const sdkInput = {
        ...input,
        idempotency_key: ` key-${literal} `,
        registration: { ...input.registration, name: `  Name${literal}  ` },
      };
      const created = await oneStorage(() =>
        client.callTool({ name: "create_application_registration", arguments: sdkInput }),
      );
      expect(created.isError).not.toBe(true);
      const original = (
        await fixtureQuery("SELECT result FROM application_registration_proposal.receipts")
      ).rows[0].result;
      expect(created.content).toHaveLength(1);
      const content = created.content as Array<{ type: string; text: string }>;
      expect(content[0].type).toBe("text");
      expect(JSON.parse(content[0].text)).toEqual(original);
      expect(original.snapshot.name).toBe(`Name${literal}`);
      const storedKey = (
        await fixtureQuery("SELECT key FROM application_registration_proposal.requests")
      ).rows[0].key;
      expect(storedKey).toBe(sdkInput.idempotency_key);
      expect(Buffer.from(storedKey)).toEqual(Buffer.from(sdkInput.idempotency_key));
      const saved = await registrationState();
      const replay = await oneStorage(() =>
        client.callTool({ name: "create_application_registration", arguments: sdkInput }),
      );
      expect(replay.content).toEqual(created.content);
      expect(await registrationState()).toEqual(saved);
      await grantRead(original.application_id);
      const selected = await oneStorage(() =>
        client.callTool({ name: "read_application_registration", arguments: select(original) }),
      );
      expect(selected.isError).not.toBe(true);
      expect(selected.content).toEqual(created.content);
    } finally {
      await client.close();
    }
  });
  it.each(["changed-actor", "terminated"])(
    "real SDK dispatch %s stops before SQL",
    async failure => {
      const client = new McpClient({ name: "synthetic-sql-negative", version: "1" });
      const abort = new AbortController();
      let seen = 0;
      let toolStatus: number | undefined;
      const transport = new StreamableHTTPClientTransport(new URL("https://fixture.invalid/mcp"), {
        requestInit: { headers: { Authorization: `Bearer ${fixture.key}` } },
        fetch: async (url, init) => {
          const toolCall =
            typeof init?.body === "string" && JSON.parse(init.body).method === "tools/call";
          const original = supabase.from.bind(supabase);
          const spy = toolCall
            ? vi.spyOn(supabase, "from").mockImplementation(table => {
                if (++seen === 2) {
                  if (failure === "changed-actor") fixture.actor = actorB;
                  else abort.abort();
                }
                return original(table);
              })
            : undefined;
          try {
            const response = await handle(
              new NextRequest(url instanceof Request ? url : String(url), {
                ...init,
                signal: abort.signal,
              }),
              dependencies,
            );
            if (toolCall) toolStatus = response.status;
            return response;
          } finally {
            spy?.mockRestore();
          }
        },
      });
      try {
        await client.connect(transport);
        const before = calls.length;
        const result = await client
          .callTool({ name: "create_application_registration", arguments: input })
          .catch(error => error);
        expect(seen).toBeGreaterThanOrEqual(2);
        if (failure === "changed-actor") {
          expect(toolStatus).toBe(200);
          expect(result.isError).toBe(true);
        } else {
          expect(toolStatus).toBe(408);
          expect(result).toBeInstanceOf(Error);
        }
        expect(calls).toHaveLength(before);
      } finally {
        await client.close();
      }
    },
  );
  it("denies native DNS, TCP, UDP and unrelated Unix sockets before access", async () => {
    expect(
      globalThis[Symbol.for("recoup.disposable.registration.originalSocketConnect")],
    ).toBeUndefined();
    const installer = globalThis[Symbol.for("recoup.disposable.registration.ownedSocketInstaller")];
    expect(Object.keys(installer).sort()).toEqual(["install", "pid"]);
    expect(Object.isFrozen(installer)).toBe(true);
    expect(() => new WebSocket("wss://fixture.invalid")).toThrow("Network forbidden");
    expect(() => http2.connect("https://fixture.invalid")).toThrow("Network forbidden");
    expect(() => new net.Server().listen(0, "127.0.0.1")).toThrow("Network forbidden");
    expect(() => dns.lookup("fixture.invalid", () => {})).toThrow("Network forbidden");
    expect(() => dns.resolve4("fixture.invalid", () => {})).toThrow("Network forbidden");
    expect(() => Reflect.construct(dns.Resolver, [])).toThrow("Network forbidden");
    expect(() => dnsPromises.resolve4("fixture.invalid")).toThrow("Network forbidden");
    await expect(dnsPromises.lookup("fixture.invalid")).rejects.toThrow("Network forbidden");
    await expect(dnsPromises.lookup("localhost")).resolves.toEqual({
      address: "127.0.0.1",
      family: 4,
    });
    expect(() => dgram.createSocket("udp4")).toThrow("Network forbidden");
    expect(() => Reflect.construct(dgram.Socket, ["udp4"])).toThrow("Network forbidden");
    expect(() => new net.Socket().connect(443, "example.invalid")).toThrow(
      "Owned Unix socket only",
    );
    expect(() => new net.Socket().connect("/tmp/unrelated-postgres-socket")).toThrow(
      "Owned Unix socket only",
    );
  });
});
