import { describe, expect, it } from "vitest";
import { deliverIngestionToPostgres } from "../deliverIngestionToPostgres";
import type { DestinationConfig } from "../destinationConfigSchema";

const config: DestinationConfig = {
  id: "test",
  scope: "account/11111111-1111-4111-8111-111111111111",
  connection_env: "INGESTION_DB_TEST",
  database_id: "33333333-3333-4333-8333-333333333333",
  schema: "public",
  table: "income",
  receipt_schema: "ingestion",
  receipt_table: "delivery_receipts",
  columns: ["id", "amount"],
  mode: "upsert",
  business_keys: ["id"],
};
const gold = {
  engine_version: "1",
  contract_version: "1",
  field_types: { id: "string" as const, amount: "decimal" as const },
  records: [{ id: "001", amount: "0.3" }],
};
function client(fail = false, existing?: unknown) {
  const queries: { sql: string; values?: unknown[] }[] = [];
  return {
    queries,
    query: async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      if (sql.startsWith("SELECT database_id"))
        return { rows: [{ database_id: config.database_id }] };
      if (sql.startsWith("SELECT artifact")) return { rows: existing ? [existing] : [] };
      if (sql.startsWith("SELECT a.attname"))
        return {
          rows: [
            { attname: "id", typname: "text" },
            { attname: "amount", typname: "numeric" },
          ],
        };
      if (fail && sql.startsWith('INSERT INTO "public"')) throw new Error("constraint rejected");
      return {
        rows: sql.startsWith('INSERT INTO "public"') ? [{ written: gold.records[0] }] : [],
        rowCount: 1,
      };
    },
  };
}
describe("transactional destination delivery", () => {
  it("writes target rows and delivery receipt before one commit", async () => {
    const db = client();
    await deliverIngestionToPostgres(config, "a".repeat(64), gold, "b".repeat(64), db);
    expect(db.queries[0].sql).toBe("BEGIN");
    expect(db.queries.at(-1)?.sql).toBe("COMMIT");
    const insert = db.queries.find(q => q.sql.startsWith('INSERT INTO "public"'))!;
    expect(insert.sql).toContain('ON CONFLICT ("id")');
    expect(insert.values).toEqual([JSON.stringify(gold.records)]);
    expect(db.queries.some(q => q.sql.startsWith('INSERT INTO "ingestion"'))).toBe(true);
  });
  it("recovers a lost acknowledgement using the destination receipt without loading twice", async () => {
    // Get the configuration fingerprint from a successful first delivery.
    const first = client();
    await deliverIngestionToPostgres(config, "a".repeat(64), gold, "b".repeat(64), first);
    const marker = first.queries.find(q => q.sql.startsWith('INSERT INTO "ingestion"'))!;
    const replay = client(false, {
      artifact_sha256: "b".repeat(64),
      target: "public.income",
      config_sha256: marker.values![3],
      row_count: 1,
    });
    expect(
      (await deliverIngestionToPostgres(config, "a".repeat(64), gold, "b".repeat(64), replay))
        .committed,
    ).toBe(true);
    expect(replay.queries.some(q => q.sql.startsWith("INSERT"))).toBe(false);
    expect(replay.queries.some(q => q.sql.startsWith("SELECT artifact"))).toBe(true);
  });
  it("rolls back both target and receipt on a failed load", async () => {
    const db = client(true);
    await expect(
      deliverIngestionToPostgres(config, "a".repeat(64), gold, "b".repeat(64), db),
    ).rejects.toThrow();
    expect(db.queries.at(-1)?.sql).toBe("ROLLBACK");
    expect(db.queries.some(q => q.sql.startsWith('INSERT INTO "ingestion"'))).toBe(false);
  });
  it("rejects invalid identifiers or mismatched columns before opening a transaction", async () => {
    const db = client();
    await expect(
      deliverIngestionToPostgres(
        { ...config, table: "income;drop" },
        "a".repeat(64),
        gold,
        "b".repeat(64),
        db,
      ),
    ).rejects.toThrow();
    await expect(
      deliverIngestionToPostgres(
        config,
        "a".repeat(64),
        { ...gold, records: [{ id: "001" }] },
        "b".repeat(64),
        db,
      ),
    ).rejects.toThrow();
    expect(db.queries.length).toBe(0);
  });
});
