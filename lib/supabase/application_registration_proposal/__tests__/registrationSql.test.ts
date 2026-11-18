import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client } from "pg";
import type { ProposedRegistrationSqlClient } from "../ProposedRegistrationSqlClient";
import { insertProposedApplicationRegistration as create } from "../insertProposedApplicationRegistration";
import { selectProposedApplicationRegistration as read } from "../selectProposedApplicationRegistration";
import {
  ProposedStorageFailure,
  type ProposedCreateCall,
  type ProposedReadCall,
} from "@/lib/applications/proposedRegistration/proposedRegistrationContract";

// Compile-time compatibility only: no client construction, cast or connection.
const compatible = (client: Client): ProposedRegistrationSqlClient => client;
void compatible;
const actor = "11111111-1111-4111-8111-111111111111";
const createCall: ProposedCreateCall = {
  actor,
  workspace: actor,
  environment: "production",
  key: "original-key",
  entitlementRevision: 1,
  registration: {
    name: "Música",
    origins: [
      {
        origin: "https://music.example",
        hostname: "music.example",
        return_urls: ["https://music.example/cb"],
      },
    ],
  },
};
const readCall: ProposedReadCall = {
  actor,
  workspace: actor,
  application: actor,
  environment: "production",
  receipt: actor,
};
const cases = [
  {
    operation: "create",
    invoke: (client: ProposedRegistrationSqlClient) => create(client, createCall),
    sql: "SELECT application_registration_execution_proposal.create_registration($1::uuid,$2::uuid,$3::text,$4::text,$5::bigint,$6::jsonb) AS receipt",
    values: [
      actor,
      actor,
      "production",
      "original-key",
      1,
      JSON.stringify(createCall.registration),
    ],
  },
  {
    operation: "read",
    invoke: (client: ProposedRegistrationSqlClient) => read(client, readCall),
    sql: "SELECT application_registration_execution_proposal.read_registration($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid) AS receipt",
    values: [actor, actor, actor, "production", actor],
  },
];
afterEach(() => vi.restoreAllMocks());
describe.each(cases)("$operation fixed proposal query", ({ operation, invoke, sql, values }) => {
  it("returns the unchanged unknown receipt with one bound query", async () => {
    const receipt = { actor, unvalidated: true };
    const query = vi.fn().mockResolvedValue({ rows: [{ receipt }] });
    expect(await invoke({ query })).toBe(receipt);
    expect(query).toHaveBeenCalledExactlyOnceWith(sql, values);
  });
  it.each(["42501", "P2101", "P0001", "P2102", "23505", "40001", undefined, 42501])(
    "classifies only exact structured code %s (synthetic)",
    async code => {
      const raw = Object.assign(new Error("PRIVATE: idempotency conflict"), { code });
      const query = vi.fn().mockRejectedValue(raw);
      const logs = [
        vi.spyOn(console, "error"),
        vi.spyOn(console, "warn"),
        vi.spyOn(console, "log"),
      ];
      const error = await invoke({ query }).catch(e => e);
      expect(error).toBeInstanceOf(ProposedStorageFailure);
      if (!(error instanceof ProposedStorageFailure)) throw new Error("Expected typed failure");
      expect(error).not.toBe(raw);
      expect(error.kind).toBe(
        code === "42501"
          ? "denied"
          : code === "P2101" && operation === "create"
            ? "conflict"
            : "outcome_unknown",
      );
      expect(error.cause).toBeUndefined();
      expect(error.message).not.toContain("PRIVATE");
      expect(query).toHaveBeenCalledTimes(1);
      for (const log of logs) expect(log).not.toHaveBeenCalled();
    },
  );
  it.each([
    null,
    "42501",
    new ProposedStorageFailure("conflict"),
    new ProposedStorageFailure("denied"),
    Object.defineProperty({}, "code", {
      get() {
        throw new Error("PRIVATE getter");
      },
    }),
  ])("does not trust client-thrown kinds or malformed errors", async raw => {
    const query = vi.fn().mockRejectedValue(raw);
    const error = await invoke({ query }).catch(e => e);
    expect(error).toBeInstanceOf(ProposedStorageFailure);
    if (!(error instanceof ProposedStorageFailure)) throw new Error("Expected typed failure");
    expect(error.kind).toBe("outcome_unknown");
    expect(error).not.toBe(raw);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it.each([
    undefined,
    null,
    {},
    { rows: [] },
    { rows: [{}, {}] },
    { rows: [{}] },
    { rows: [{ receipt: null }] },
    { rows: [{ receipt: undefined }] },
    { rows: [null] },
  ])("rejects a malformed envelope", async result => {
    const query = vi.fn().mockResolvedValue(result);
    await expect(invoke({ query })).rejects.toMatchObject({ kind: "outcome_unknown" });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
it("serialization failure is unknown before any query", async () => {
  const call = structuredClone(createCall);
  Object.defineProperty(call.registration, "toJSON", {
    value: () => {
      throw new Error("PRIVATE");
    },
  });
  const query = vi.fn();
  await expect(create({ query }, call)).rejects.toMatchObject({ kind: "outcome_unknown" });
  expect(query).not.toHaveBeenCalled();
});
it("missing serialization is unknown before any query", async () => {
  const call = structuredClone(createCall);
  Object.defineProperty(call.registration, "toJSON", { value: () => undefined });
  const query = vi.fn();
  await expect(create({ query }, call)).rejects.toMatchObject({ kind: "outcome_unknown" });
  expect(query).not.toHaveBeenCalled();
});
