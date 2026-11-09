import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { deliverIngestionToPostgres } from "../deliverIngestionToPostgres";
import { runIngestionPipeline } from "../runIngestionPipeline";
import { ingestionContractSchema } from "../schemas";
import { hashIngestionValue } from "../hashIngestionValue";
import type { DestinationConfig } from "../destinationConfigSchema";

// Explicitly opt in against a disposable local database. No production credentials are used.
const url = process.env.INGESTION_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("real Postgres delivery", () => {
  const schema = `ingestion_test_${process.pid}`;
  const config: DestinationConfig = {
    id: "test",
    scope: "account/11111111-1111-4111-8111-111111111111",
    connection_env: "INGESTION_DB_TEST",
    database_id: "33333333-3333-4333-8333-333333333333",
    schema,
    table: "income",
    receipt_schema: schema,
    receipt_table: "delivery_receipts",
    columns: ["id", "amount"],
    mode: "upsert",
    business_keys: ["id"],
  };
  let db: Client;
  const contract = ingestionContractSchema.parse({
    version: "1",
    fields: [
      { name: "id", source: "ID", type: "string" },
      { name: "amount", source: "Amount", type: "decimal" },
    ],
  });
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
      !parsed.pathname.endsWith("/ingestion_test")
    )
      throw new Error("Disposable local ingestion_test database required");
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query(
      `CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.income (id text PRIMARY KEY, amount numeric(20, 4) NOT NULL); CREATE TABLE ${schema}.delivery_receipts (delivery_id text PRIMARY KEY, artifact_sha256 text NOT NULL, target text NOT NULL, config_sha256 text NOT NULL, row_count integer NOT NULL, committed_at timestamptz NOT NULL DEFAULT now())`,
    );
    await db.query(
      `CREATE TABLE ${schema}.destination_identity (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), database_id uuid NOT NULL UNIQUE)`,
    );
    await db.query(`INSERT INTO ${schema}.destination_identity(database_id) VALUES ($1)`, [
      config.database_id,
    ]);
  });
  afterAll(async () => {
    if (db) {
      await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await db.end();
    }
  });
  it("loads the pipeline's output once and recovers an acknowledgement retry", async () => {
    const result = await runIngestionPipeline(
      Buffer.from("ID,Amount\n001,0.1\n002,0.2"),
      "csv",
      contract,
    );
    const digest = hashIngestionValue(result.gold);
    await deliverIngestionToPostgres(config, "1".repeat(64), result.gold!, digest, db);
    await deliverIngestionToPostgres(config, "1".repeat(64), result.gold!, digest, db);
    const rows = await db.query(`SELECT id, amount::text FROM ${schema}.income ORDER BY id`);
    expect(rows.rows).toEqual([
      { id: "001", amount: "0.1000" },
      { id: "002", amount: "0.2000" },
    ]);
    expect(
      (await db.query(`SELECT count(*)::int n FROM ${schema}.delivery_receipts`)).rows[0].n,
    ).toBe(1);
  });
  it("rolls back rounding and leaves previously published output unchanged", async () => {
    const result = await runIngestionPipeline(
      Buffer.from("ID,Amount\n001,0.123456"),
      "csv",
      contract,
    );
    await expect(
      deliverIngestionToPostgres(
        config,
        "2".repeat(64),
        result.gold!,
        hashIngestionValue(result.gold),
        db,
      ),
    ).rejects.toThrow("Destination value mismatch");
    expect(
      (await db.query(`SELECT amount::text FROM ${schema}.income WHERE id='001'`)).rows[0].amount,
    ).toBe("0.1000");
    expect(
      (
        await db.query(
          `SELECT count(*)::int n FROM ${schema}.delivery_receipts WHERE delivery_id=$1`,
          ["2".repeat(64)],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("refuses a different logical database or a conflicting delivery receipt", async () => {
    const result = await runIngestionPipeline(
      Buffer.from("ID,Amount\n001,0.1\n002,0.2"),
      "csv",
      contract,
    );
    await expect(
      deliverIngestionToPostgres(
        { ...config, database_id: "44444444-4444-4444-8444-444444444444" },
        "5".repeat(64),
        result.gold!,
        hashIngestionValue(result.gold),
        db,
      ),
    ).rejects.toThrow("Destination identity mismatch");
    await expect(
      deliverIngestionToPostgres(config, "1".repeat(64), result.gold!, "f".repeat(64), db),
    ).rejects.toThrow("Delivery receipt conflict");
    expect(
      (await db.query(`SELECT amount::text FROM ${schema}.income WHERE id='001'`)).rows[0].amount,
    ).toBe("0.1000");
  });
  it("rejects numeric target columns for string identifiers", async () => {
    await db.query(`CREATE TABLE ${schema}.numeric_ids (id bigint PRIMARY KEY, amount numeric)`);
    const result = await runIngestionPipeline(Buffer.from("ID,Amount\n001,0.3"), "csv", contract);
    await expect(
      deliverIngestionToPostgres(
        { ...config, table: "numeric_ids" },
        "3".repeat(64),
        result.gold!,
        hashIngestionValue(result.gold),
        db,
      ),
    ).rejects.toThrow("Destination type mismatch");
    expect((await db.query(`SELECT count(*)::int n FROM ${schema}.numeric_ids`)).rows[0].n).toBe(0);
  });
  it("serializes concurrent delivery attempts around the same durable receipt", async () => {
    const other = new Client({ connectionString: url });
    await other.connect();
    try {
      const result = await runIngestionPipeline(Buffer.from("ID,Amount\n003,0.5"), "csv", contract);
      await Promise.all(
        [db, other].map(connection =>
          deliverIngestionToPostgres(
            config,
            "4".repeat(64),
            result.gold!,
            hashIngestionValue(result.gold),
            connection,
          ),
        ),
      );
      expect(
        (
          await db.query(
            `SELECT count(*)::int n FROM ${schema}.delivery_receipts WHERE delivery_id=$1`,
            ["4".repeat(64)],
          )
        ).rows[0].n,
      ).toBe(1);
    } finally {
      await other.end();
    }
  });
});
