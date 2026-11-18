import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { userInfo } from "node:os";
import net from "node:net";
import dgram from "node:dgram";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { NextRequest, NextResponse } from "next/server";
import { fixture } from "../setup";
import { installOwnedSocketGuard } from "./socket-guard.mjs";
import { createProposedApplicationRegistration as create } from "@/lib/applications/proposedRegistration/createProposedApplicationRegistration";
import { readProposedApplicationRegistration as read } from "@/lib/applications/proposedRegistration/readProposedApplicationRegistration";
import {
  ProposedStorageFailure,
  type ProposedDependencies,
  type ProposedCreateCall,
  type ProposedReadCall,
} from "@/lib/applications/proposedRegistration/proposedRegistrationContract";

// The shared auth setup denies all sockets; restore only the prevalidated owned Unix socket.
installOwnedSocketGuard();
const actorA = "11111111-1111-4111-8111-111111111111";
const actorB = "33333333-3333-4333-8333-333333333333";
const socket = process.env.REGISTRATION_QUALIFICATION_SOCKET!;
const sql = new Client({
  host: socket,
  port: 55473,
  user: userInfo().username,
  database: "postgres",
  ssl: false,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
  statement_timeout: 10000,
  application_name: "registration-domain-composition",
});
const calls: Array<{ operation: "create" | "read"; state: string; parameters: number }> = [];
let fixtureQueries = 0;
let dropCommittedResponse = false;
let server: { version: string; encoding: string };
const fixtureQuery = async (text: string, values: unknown[] = []) => {
  fixtureQueries++;
  return sql.query(text, values);
};
const execute = async (operation: "create" | "read", text: string, values: unknown[]) => {
  const observation = { operation, state: "started", parameters: values.length };
  calls.push(observation);
  let result;
  try {
    result = await sql.query(text, values);
    observation.state = "committed";
  } catch (error) {
    const code = (error as { code?: string }).code;
    observation.state = code ?? "unclassified";
    // P0001 includes multiple unrelated failures. Never classify it from exception text.
    if (code === "42501") throw new ProposedStorageFailure("denied");
    throw error;
  }
  if (dropCommittedResponse && operation === "create") {
    dropCommittedResponse = false;
    observation.state = "committed_response_dropped";
    throw new Error("Synthetic response loss after actual SQL commit");
  }
  return result.rows[0].receipt;
};
const dependencies: ProposedDependencies = {
  policy: {
    status: "proposed_unadopted",
    version: "proposed-personal-v1",
    databaseHead: "df7be4c65b98924373b38c7d257f4b1c1820d6b7",
  },
  storage: {
    create: (call: ProposedCreateCall) =>
      execute(
        "create",
        "SELECT application_registration_proposal.register_application($1::uuid,$2::uuid,$3::text,$4::text,$5::bigint,$6::jsonb) AS receipt",
        [
          call.actor,
          call.workspace,
          call.environment,
          call.key,
          call.entitlementRevision,
          JSON.stringify(call.registration),
        ],
      ),
    read: (call: ProposedReadCall) =>
      execute(
        "read",
        "SELECT application_registration_proposal.read_registration($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid) AS receipt",
        [call.actor, call.workspace, call.application, call.environment, call.receipt],
      ),
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

beforeAll(async () => {
  await sql.connect();
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
  await sql.end();
  console.log(
    "COMPOSITION_RECEIPT " +
      JSON.stringify({ server, storageCalls: calls, fixtureQueries, activation: false }),
  );
});

describe("actual domain to exact disposable SQL proposal", () => {
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
    expect(await register()).toEqual(original);
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
    ).rejects.toMatchObject({ kind: "outcome_unknown" });
    expect(calls.at(-1)?.state).toBe("P0001");
    expect(
      (await fixtureQuery("SELECT result FROM application_registration_proposal.receipts")).rows[0]
        .result,
    ).toEqual(original);
  });
  it("does not infer a conflict class from another generic P0001 failure", async () => {
    await expect(register({ ...input, expected_entitlement_revision: 2 })).rejects.toMatchObject({
      kind: "outcome_unknown",
    });
    expect(calls.at(-1)?.state).toBe("P0001");
    expect(
      (
        await fixtureQuery(
          "SELECT count(*)::int AS n FROM application_registration_proposal.applications",
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("rechecks SQL authority before replay and read, and fresh auth before storage", async () => {
    const receipt = await register();
    await grantRead(receipt.application_id);
    await fixtureQuery(
      "UPDATE application_registration_proposal.create_entitlements SET enabled=false WHERE actor=$1::uuid",
      [actorA],
    );
    await expect(register()).rejects.toMatchObject({ kind: "denied" });
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
  it("denies native DNS, TCP, UDP and unrelated Unix sockets before access", async () => {
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
