import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import golden from "../../../../scripts/application-registration-proposal/receipt-golden.json";
import { fixture } from "../../../../scripts/application-registration-proposal/setup";
import { createProposedApplicationRegistration as create } from "../createProposedApplicationRegistration";
import { readProposedApplicationRegistration as read } from "../readProposedApplicationRegistration";
import { assertProposedRegistrationReceipt } from "../assertProposedRegistrationReceipt";
import { projectProposedRegistration } from "../projectProposedRegistration";
import {
  ProposedStorageFailure,
  type ProposedDependencies,
  type ProposedCreateCall,
} from "../proposedRegistrationContract";
const policy = {
  status: "proposed_unadopted",
  version: "proposed-personal-v1",
  databaseHead: golden.databaseHead,
} as ProposedDependencies["policy"];
const input = {
  idempotency_key: golden.input.key,
  expected_entitlement_revision: 1,
  registration: {
    name: golden.input.registration.name,
    environment: "production" as const,
    allowed_origins: golden.input.registration.origins.map(o => o.origin).reverse(),
    return_urls: golden.input.registration.origins.flatMap(o => o.return_urls),
  },
};
const request = () =>
  new NextRequest("https://fixture.invalid", { headers: { "x-api-key": fixture.key } });
const selected = {
  application_id: golden.createReceipt.application_id,
  environment: "production" as const,
  receipt_id: golden.createReceipt.receipt_id,
};
const dependencies = () => ({
  policy,
  storage: {
    create: vi.fn(async () => structuredClone(golden.createReceipt)),
    read: vi.fn(async () => structuredClone(golden.readReceipt)),
  },
});
describe("unwired create/read transaction binding", () => {
  it("accepts actual SQL-generated create/read bytes without date or precision coercion", async () => {
    const deps = dependencies();
    const created = await create(request(), input, deps);
    const loaded = await read(request(), selected, deps);
    expect(created).toEqual(golden.createReceipt);
    expect(loaded).toEqual(golden.readReceipt);
    expect(created.recorded_at).toBe(golden.createReceipt.recorded_at);
    expect(created.recorded_at).toMatch(/\.\d{6}\+00:00$/);
    expect(deps.storage.create).toHaveBeenCalledExactlyOnceWith(golden.input);
    expect(deps.storage.read).toHaveBeenCalledExactlyOnceWith({
      actor: fixture.actor,
      workspace: fixture.actor,
      application: selected.application_id,
      environment: selected.environment,
      receipt: selected.receipt_id,
    });
    expect(JSON.stringify(deps.storage.create.mock.calls)).not.toContain(fixture.key);
  });
  it("has no inferred authority and invokes the port at most once", async () => {
    for (const kind of ["denied", "conflict"] as const) {
      const deps = dependencies();
      const failure = new ProposedStorageFailure(kind);
      deps.storage.create.mockRejectedValue(failure);
      await expect(create(request(), input, deps)).rejects.toBe(failure);
      expect(deps.storage.create).toHaveBeenCalledTimes(1);
      expect(deps.storage.read).not.toHaveBeenCalled();
      deps.storage.read.mockRejectedValue(failure);
      await expect(read(request(), selected, deps)).rejects.toBe(failure);
      expect(deps.storage.read).toHaveBeenCalledTimes(1);
    }
  });
  it.each([new Error("timeout"), undefined, { kind: "denied" }, null])(
    "keeps ambiguous errors unknown",
    async error => {
      const deps = dependencies();
      deps.storage.create.mockRejectedValue(error);
      await expect(create(request(), input, deps)).rejects.toMatchObject({
        kind: "outcome_unknown",
      });
      expect(deps.storage.create).toHaveBeenCalledTimes(1);
    },
  );
  it("recovers a simulated committed response only by explicit original-key retry, with fresh authorization", async () => {
    let stored: ProposedCreateCall | undefined;
    let allowed = true;
    let loseResponse = true;
    const deps: ProposedDependencies = {
      policy,
      storage: {
        create: vi.fn(async call => {
          if (!allowed) throw new ProposedStorageFailure("denied");
          if (stored && JSON.stringify(stored) !== JSON.stringify(call))
            throw new ProposedStorageFailure("conflict");
          stored ??= structuredClone(call);
          if (loseResponse) {
            loseResponse = false;
            throw new Error("Response lost after synthetic commit");
          }
          return structuredClone(golden.createReceipt);
        }),
        read: vi.fn(),
      },
    };
    await expect(create(request(), input, deps)).rejects.toMatchObject({ kind: "outcome_unknown" });
    expect(deps.storage.create).toHaveBeenCalledTimes(1);
    expect(await create(request(), input, deps)).toEqual(golden.createReceipt);
    expect(stored).toEqual(golden.input);
    await expect(
      create(
        request(),
        { ...input, registration: { ...input.registration, name: "Changed" } },
        deps,
      ),
    ).rejects.toMatchObject({ kind: "conflict" });
    allowed = false;
    await expect(create(request(), input, deps)).rejects.toMatchObject({ kind: "denied" });
    fixture.keyPresent = false;
    const calls = vi.mocked(deps.storage.create).mock.calls.length;
    await expect(create(request(), input, deps)).rejects.toBeDefined();
    expect(deps.storage.create).toHaveBeenCalledTimes(calls);
  });
  it("rejects body authority/organization overrides and invalid canonical input before storage", async () => {
    const deps = dependencies();
    for (const value of [
      { ...input, actor: fixture.actor },
      { ...input, account_id: fixture.actor },
      { ...input, policy },
      { ...input, registration: { ...input.registration, organization_id: fixture.actor } },
      {
        ...input,
        registration: { ...input.registration, allowed_origins: ["https://music.example/"] },
      },
      {
        ...input,
        registration: { ...input.registration, return_urls: ["https://other.example/return"] },
      },
      {
        ...input,
        registration: { ...input.registration, return_urls: ["https://music.example/return#hash"] },
      },
      {
        ...input,
        registration: {
          ...input.registration,
          allowed_origins: ["https://music.example", "https://music.example"],
        },
      },
      { ...input, expected_entitlement_revision: Number.MAX_SAFE_INTEGER + 1 },
      { ...input, idempotency_key: "" },
    ])
      await expect(create(request(), value, deps)).rejects.toBeDefined();
    expect(deps.storage.create).not.toHaveBeenCalled();
    for (const override of [
      { ...policy, version: "adopted" },
      undefined,
      { ...policy, databaseHead: "wrong" },
    ])
      await expect(
        create(request(), input, { ...deps, policy: override } as ProposedDependencies),
      ).rejects.toBeDefined();
    expect(deps.storage.create).not.toHaveBeenCalled();
    await expect(
      create(request(), input, { policy, storage: {} } as ProposedDependencies),
    ).rejects.toThrow("unavailable");
  });
  it.each(["df7be4c65b98924373b38c7d257f4b1c1820d6b7", "wrong"])(
    "rejects incompatible database descriptor %s before either storage port",
    async databaseHead => {
      const deps = dependencies();
      const incompatible = {
        ...deps,
        policy: { ...policy, databaseHead },
      } as ProposedDependencies;
      await expect(create(request(), input, incompatible)).rejects.toThrow();
      await expect(read(request(), selected, incompatible)).rejects.toThrow();
      expect(deps.storage.create).not.toHaveBeenCalled();
      expect(deps.storage.read).not.toHaveBeenCalled();
    },
  );
  it("uses bytewise canonical ordering and preserves development loopback eligibility", async () => {
    const body = {
      name: "字",
      environment: "development",
      allowed_origins: ["http://localhost:3000"],
      return_urls: ["http://localhost:3000/A", "http://localhost:3000/%C3%A9"],
    };
    const projected = await projectProposedRegistration(fixture.actor, body);
    expect(projected.registration.origins[0].return_urls).toEqual([
      "http://localhost:3000/%C3%A9",
      "http://localhost:3000/A",
    ]);
    await expect(
      projectProposedRegistration(fixture.actor, {
        ...body,
        return_urls: ["http://localhost:3000/é"],
      }),
    ).rejects.toThrow();
    await expect(
      projectProposedRegistration(fixture.actor, { ...body, environment: "production" }),
    ).rejects.toThrow();
  });
  it("HTTP-shaped JSON and MCP-shaped argument fixtures produce the same domain call, not MCP auth parity", async () => {
    const http = JSON.parse(JSON.stringify(input));
    const mcp = { name: "synthetic-unregistered-create", arguments: structuredClone(input) };
    const one = dependencies(),
      two = dependencies();
    expect(await create(request(), http, one)).toEqual(await create(request(), mcp.arguments, two));
    expect(one.storage.create.mock.calls).toEqual(two.storage.create.mock.calls);
  });
});
describe("strict receipt acceptance", () => {
  const mutations: Array<[string, (x: any) => void]> = [
    [
      "uppercase generated receipt",
      x => {
        x.receipt_id = x.receipt_id.toUpperCase();
      },
    ],
    [
      "uppercase generated application",
      x => {
        x.application_id = x.application_id.toUpperCase();
        x.snapshot.application_id = x.application_id;
      },
    ],
    [
      "actor",
      x => {
        x.actor = fixture.keyId;
      },
    ],
    [
      "workspace",
      x => {
        x.workspace_id = fixture.keyId;
      },
    ],
    [
      "billing",
      x => {
        x.billing_owner_id = fixture.keyId;
      },
    ],
    [
      "environment",
      x => {
        x.environment = "development";
      },
    ],
    [
      "snapshot application",
      x => {
        x.snapshot.application_id = fixture.keyId;
      },
    ],
    [
      "name",
      x => {
        x.snapshot.name = "Changed";
      },
    ],
    [
      "origin set",
      x => {
        x.snapshot.allowed_origins.pop();
      },
    ],
    [
      "return destinations",
      x => {
        x.snapshot.return_urls = ["https://music.example/other"];
      },
    ],
    [
      "origin revisions",
      x => {
        x.snapshot.origins[0].cas_revision = 2;
      },
    ],
    [
      "extra field",
      x => {
        x.authorized = true;
      },
    ],
    [
      "policy",
      x => {
        x.policy_version = "adopted";
      },
    ],
    [
      "evidence",
      x => {
        x.evidence_kind = "production";
      },
    ],
    [
      "entitlement revision",
      x => {
        x.entitlement_revision = 2;
      },
    ],
    [
      "bigint overflow",
      x => {
        x.entitlement_revision = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    ...[
      "origins_verified",
      "bootstrap_enabled",
      "access_activated",
      "runtime_enabled",
      "production_persisted",
    ].map(
      flag =>
        [
          flag,
          (x: any) => {
            x[flag] = true;
          },
        ] as [string, (x: any) => void],
    ),
    [
      "timestamp precision",
      x => {
        x.recorded_at = "2026-11-17T01:02:03.1234567+00:00";
      },
    ],
    [
      "non-UTC timestamp",
      x => {
        x.recorded_at = "2026-11-17T01:02:03+01:00";
      },
    ],
  ];
  it.each(mutations)(
    "rejects altered %s without sanitizing into success",
    async (_name, change) => {
      const raw = structuredClone(golden.createReceipt);
      change(raw);
      await expect(
        assertProposedRegistrationReceipt(raw, golden.input as ProposedCreateCall),
      ).rejects.toBeDefined();
      const deps = dependencies();
      deps.storage.create.mockResolvedValue(raw);
      await expect(create(request(), input, deps)).rejects.toMatchObject({
        kind: "outcome_unknown",
      });
      expect(deps.storage.create).toHaveBeenCalledTimes(1);
    },
  );
  it("canonicalizes uppercase read selectors while preserving the SQL golden receipt", async () => {
    const deps = dependencies();
    const aliases = {
      ...selected,
      application_id: selected.application_id.toUpperCase(),
      receipt_id: selected.receipt_id.toUpperCase(),
    };
    expect(aliases.application_id).not.toBe(selected.application_id);
    expect(aliases.receipt_id).not.toBe(selected.receipt_id);
    expect(await read(request(), aliases, deps)).toEqual(golden.readReceipt);
    expect(deps.storage.read).toHaveBeenCalledExactlyOnceWith({
      actor: fixture.actor,
      workspace: fixture.actor,
      application: selected.application_id,
      environment: selected.environment,
      receipt: selected.receipt_id,
    });
    expect(deps.storage.create).not.toHaveBeenCalled();
  });
  it.each(["application_id", "receipt_id"] as const)(
    "does not normalize returned %s aliases into success",
    async field => {
      const deps = dependencies();
      const altered = structuredClone(golden.readReceipt);
      altered[field] = altered[field].toUpperCase();
      deps.storage.read.mockResolvedValue(altered);
      await expect(read(request(), selected, deps)).rejects.toMatchObject({
        kind: "outcome_unknown",
      });
      expect(deps.storage.read).toHaveBeenCalledTimes(1);
    },
  );
  it("checks read selection and preserves SQL timestamp representations", async () => {
    const deps = dependencies();
    await expect(
      read(request(), { ...selected, application_id: fixture.keyId }, deps),
    ).rejects.toMatchObject({ kind: "outcome_unknown" });
    await expect(
      read(request(), { ...selected, receipt_id: fixture.keyId }, deps),
    ).rejects.toMatchObject({ kind: "outcome_unknown" });
    for (const recorded_at of ["2026-11-17T01:02:03Z", "2026-11-17T01:02:03.123456+00:00"]) {
      const value = await assertProposedRegistrationReceipt(
        { ...golden.createReceipt, recorded_at },
        golden.input as ProposedCreateCall,
      );
      expect(value.recorded_at).toBe(recorded_at);
    }
  });
});
