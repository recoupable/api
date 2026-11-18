import { expect, it, vi, afterEach, beforeEach } from "vitest";
import { fixtureSql as sql } from "./fixtureSql";
import { writeFileSync } from "node:fs";
import { catalogCaseSnapshotSchema } from "@/lib/context/catalogCaseSnapshotSchema";
import { processCatalogCaseOperation } from "@/lib/context/processCatalogCaseOperation";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { networkAttempts } from "../sites-evidence-sql-bridge/network-deny";
const errors: unknown[] = [];
const test = process.env.SITES_BRIDGE_SOCKET ? it : it.skip;
function inputSnapshot() {
  return {
    schema_version: 1,
    case_id: "11111111-1111-4111-8111-111111111111",
    workspace_id: "22222222-2222-4222-8222-222222222222",
    revision: 0,
    scope: "synthetic numeric preservation",
    sources: {
      s: {
        id: "s",
        version: "v1",
        sha256: "a".repeat(64),
        locator: "synthetic",
        status: "active",
        data: { values: Array(11000).fill(1e100) },
      },
    },
    assessments: {},
    findings: {},
    actions: {},
    attempts: {},
    outcomes: {},
  };
}
beforeEach(() => {
  if (!process.env.SITES_BRIDGE_SOCKET) return;
  errors.length = 0;
  sql(
    "TRUNCATE context_catalog_cases CASCADE; INSERT INTO accounts(id,name) VALUES ('22222222-2222-4222-8222-222222222222','Synthetic') ON CONFLICT DO NOTHING;",
  );
});

function quote(v: unknown) {
  return v === null
    ? "NULL"
    : "'" + (typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll("'", "''") + "'";
}
vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name !== "save_context_catalog_case") throw new Error("Unexpected RPC");
      try {
        return {
          data: JSON.parse(
            sql(
              `SET ROLE service_role; SELECT public.save_context_catalog_case(${["p_actor", "p_owner", "p_case", "p_expected_revision", "p_key", "p_snapshot"].map(k => quote(args[k])).join(",")});`,
            ),
          ),
          error: null,
        };
      } catch (e) {
        const x = e as Error & { code: string };
        if (!x.code) throw e;
        errors.push({ code: x.code, message: x.message });
        return {
          data: null,
          error: {
            code: x.code,
            message: x.message.match(/ERROR:\s+[0-9A-Z]{5}:\s+([^\n]+)/)?.[1] ?? x.message,
          },
        };
      }
    },
  },
}));
afterEach(() => expect(networkAttempts).toEqual([]));
test("exposes actual storage bound while retaining small roundtrip/replay", async () => {
  const raw = inputSnapshot();
  const snapshot = catalogCaseSnapshotSchema.parse(raw);
  const actor = snapshot.workspace_id;
  sql(
    `INSERT INTO accounts(id,name) VALUES (${quote(actor)},'Synthetic size fixture') ON CONFLICT DO NOTHING;`,
  );
  const bytes = Number(sql(`SELECT octet_length(${quote(snapshot)}::jsonb::text);`));
  const count = () =>
    sql(
      "SELECT (SELECT count(*) FROM context_catalog_cases)||':'||(SELECT count(*) FROM context_catalog_case_revisions);",
    );
  const invoke = (s: typeof snapshot, key: string) =>
    processCatalogCaseOperation(
      actor,
      actor,
      {
        action: "save_catalog_case",
        case_id: s.case_id,
        expected_revision: s.revision,
        idempotency_key: key,
        snapshot: s,
      },
      callContextRpc,
    );
  const before = count();
  let rejection: unknown;
  try {
    await invoke(snapshot, "oversized");
  } catch (e) {
    rejection = e;
  }
  expect(bytes).toBeGreaterThan(1048576);
  expect(count()).toBe(before);
  const afterOversize = count();
  expect(errors).toHaveLength(1);
  const small = structuredClone(snapshot);
  small.sources.s.data!.values = [1e100, 1e-100, 0.1, "音楽", null, true];
  const first = await invoke(small, "small");
  const replay = await invoke(small, "small");
  expect(replay).toEqual(first);
  expect(first).toMatchObject({ snapshot: { sources: { s: { data: small.sources.s.data } } } });
  expect(count()).toBe("1:1");
  writeFileSync(
    process.env.CATALOG_RESULT!,
    JSON.stringify(
      {
        compactBytes: Buffer.byteLength(JSON.stringify(snapshot)),
        postgresBytes: bytes,
        sqlErrors: errors,
        rejection: { name: (rejection as Error)?.name, message: (rejection as Error)?.message },
        before,
        afterOversize,
        afterPositive: count(),
        positiveReplay: true,
      },
      null,
      2,
    ),
  );
  // The exact proposal signal maps to the safe domain error; unrelated failures stay generic.
  expect(rejection).toMatchObject({ name: "CatalogSnapshotTooLargeError" });
});
test.each([9, 99])(
  "rejects actual stored revision digit growth at %i without a head change",
  async revision => {
    const snapshot = catalogCaseSnapshotSchema.parse(inputSnapshot());
    snapshot.case_id = `33333333-3333-4333-8333-${String(revision).padStart(12, "0")}`;
    snapshot.revision = revision;
    snapshot.sources.s.data = { padding: "" };
    const size = (s: typeof snapshot) =>
      Number(sql(`SELECT octet_length(${quote(s)}::jsonb::text);`));
    const base = size(snapshot);
    snapshot.sources.s.data.padding = "x".repeat(1048576 - base);
    expect(size(snapshot)).toBe(1048576);
    catalogCaseSnapshotSchema.parse(snapshot);
    sql(
      `INSERT INTO context_catalog_cases(id,owner_id,created_by,revision) VALUES (${quote(snapshot.case_id)},${quote(snapshot.workspace_id)},${quote(snapshot.workspace_id)},${revision});`,
    );
    const state = () =>
      sql(
        `SELECT jsonb_build_object('head',(SELECT to_jsonb(c) FROM context_catalog_cases c WHERE id=${quote(snapshot.case_id)}),'revisions',(SELECT count(*) FROM context_catalog_case_revisions WHERE case_id=${quote(snapshot.case_id)}));`,
      );
    const before = state();
    let error: unknown;
    try {
      await processCatalogCaseOperation(
        snapshot.workspace_id,
        snapshot.workspace_id,
        {
          action: "save_catalog_case",
          case_id: snapshot.case_id,
          expected_revision: revision,
          idempotency_key: `growth-${revision}`,
          snapshot,
        },
        callContextRpc,
      );
    } catch (e) {
      error = e;
    }
    expect(state()).toBe(before);
    writeFileSync(
      process.env.CATALOG_RESULT!.replace(".json", `-growth-${revision}.json`),
      JSON.stringify(
        {
          incomingBytes: size(snapshot),
          storedBytes: size({ ...snapshot, revision: revision + 1 }),
          compactBytes: Buffer.byteLength(JSON.stringify(snapshot)),
          unchanged: true,
          error: { name: (error as Error)?.name, message: (error as Error)?.message },
          sqlError: errors.at(-1),
        },
        null,
        2,
      ),
    );
    expect(error).toMatchObject({ name: "CatalogSnapshotTooLargeError" });
    expect(errors.at(-1)).toMatchObject({ code: "22001" });
    snapshot.sources.s.data!.padding = String(snapshot.sources.s.data!.padding).slice(1);
    const operation = {
      action: "save_catalog_case" as const,
      case_id: snapshot.case_id,
      expected_revision: revision,
      idempotency_key: `growth-${revision}`,
      snapshot,
    };
    const save = () =>
      processCatalogCaseOperation(
        snapshot.workspace_id,
        snapshot.workspace_id,
        operation,
        callContextRpc,
      );
    const saved = await save();
    expect(await save()).toEqual(saved);
    expect(size({ ...snapshot, revision: revision + 1 })).toBe(1048576);
    const committed = state();
    await expect(
      processCatalogCaseOperation(
        snapshot.workspace_id,
        snapshot.workspace_id,
        { ...operation, idempotency_key: `stale-${revision}` },
        callContextRpc,
      ),
    ).rejects.toThrow("Catalog revision conflict");
    expect(errors.at(-1)).toMatchObject({ code: "40001" });
    expect(state()).toBe(committed);
    await expect(
      processCatalogCaseOperation(
        snapshot.workspace_id,
        snapshot.workspace_id,
        { ...operation, snapshot: { ...snapshot, scope: "changed" } },
        callContextRpc,
      ),
    ).rejects.toThrow("Catalog key reused for different input");
    expect(errors.at(-1)).toMatchObject({ code: "22023" });
    expect(state()).toBe(committed);
  },
);
