import { destinationConfigSchema, type DestinationConfig } from "./destinationConfigSchema";
import { hashIngestionValue } from "./hashIngestionValue";
import { verifyIngestionDestinationIdentity } from "./verifyIngestionDestinationIdentity";
import type { GoldArtifact, IngestionSqlClient } from "./types";
import Decimal from "decimal.js";

/** Publish rows and an idempotency receipt in the same client-database transaction. */
export async function deliverIngestionToPostgres(
  input: DestinationConfig,
  deliveryId: string,
  gold: GoldArtifact,
  digest: string,
  client: IngestionSqlClient,
): Promise<{ committed: boolean; rows: number }> {
  const config = destinationConfigSchema.parse(input);
  if (
    !/^[a-f0-9]{64}$/.test(deliveryId) ||
    !/^[a-f0-9]{64}$/.test(digest) ||
    !gold.records.length ||
    gold.records.length > 10000
  )
    throw new Error("Invalid delivery");
  if (
    !gold.field_types ||
    config.columns.some(k => !gold.field_types[k]) ||
    gold.records.some(
      row =>
        Object.keys(row).length !== config.columns.length ||
        config.columns.some(
          k => !Object.hasOwn(row, k) || (row[k] !== null && typeof row[k] !== "string"),
        ),
    )
  )
    throw new Error("Destination columns mismatch");
  // An immutable config fingerprint prevents target changes from silently reusing an old receipt.
  const configDigest = hashIngestionValue(config);
  const quote = (name: string) => `"${name}"`;
  const target = `${quote(config.schema)}.${quote(config.table)}`;
  const receiptTable = `${quote(config.receipt_schema)}.${quote(config.receipt_table)}`;
  const targetName = `${config.schema}.${config.table}`;
  const columns = config.columns.map(quote).join(", ");
  const updateColumns = config.columns.filter(k => !config.business_keys.includes(k));
  if (!updateColumns.length) updateColumns.push(config.columns[0]);
  const conflict =
    config.mode === "upsert"
      ? ` ON CONFLICT (${config.business_keys.map(quote).join(", ")}) DO UPDATE SET ${updateColumns.map(k => `${quote(k)} = EXCLUDED.${quote(k)}`).join(", ")}`
      : "";
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '20000'");
    await client.query("SET LOCAL lock_timeout = '5000'");
    await client.query("SET LOCAL DateStyle = 'ISO, YMD'");
    await verifyIngestionDestinationIdentity(config, client);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [deliveryId]);
    const existing = await client.query(
      `SELECT artifact_sha256, target, config_sha256, row_count FROM ${receiptTable} WHERE delivery_id = $1`,
      [deliveryId],
    );
    if (existing.rows.length) {
      const row = existing.rows[0];
      if (
        row.artifact_sha256 !== digest ||
        row.target !== targetName ||
        row.config_sha256 !== configDigest ||
        Number(row.row_count) !== gold.records.length
      )
        throw new Error("Delivery receipt conflict");
      await client.query("COMMIT");
      return { committed: true, rows: Number(row.row_count) };
    }
    const shape = await client.query(
      "SELECT a.attname, t.typname FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_type t ON t.oid = a.atttypid WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped",
      [target],
    );
    const allowed = {
      string: ["text", "varchar", "bpchar"],
      decimal: ["numeric"],
      integer: ["int2", "int4", "int8", "numeric"],
      date: ["date"],
      boolean: ["bool"],
    };
    for (const name of config.columns) {
      const column = shape.rows.find(r => r.attname === name);
      if (!column || !allowed[gold.field_types[name]]?.includes(String(column.typname)))
        throw new Error("Destination type mismatch");
    }
    const returning = config.columns.map(k => `'${k}', ${quote(k)}::text`).join(", ");
    const written = await client.query(
      `INSERT INTO ${target} (${columns}) SELECT ${columns} FROM jsonb_populate_recordset(NULL::${target}, $1::jsonb)${conflict} RETURNING jsonb_build_object(${returning}) AS written`,
      [JSON.stringify(gold.records)],
    );
    // Compare exact values returned by Postgres before committing: numeric scale and triggers
    // must not silently change accepted amounts or identifiers.
    const signature = (row: Record<string, unknown>) =>
      JSON.stringify(
        config.columns.map(k => {
          const value = row[k];
          if (value === null) return null;
          if (typeof value !== "string") throw new Error("Destination value mismatch");
          return ["decimal", "integer"].includes(gold.field_types[k])
            ? new Decimal(value).toFixed()
            : value;
        }),
      );
    const expectedRows = gold.records.map(signature).sort();
    const actualRows = written.rows
      .map(r => signature(r.written as Record<string, unknown>))
      .sort();
    if (JSON.stringify(expectedRows) !== JSON.stringify(actualRows))
      throw new Error("Destination value mismatch");
    await client.query(
      `INSERT INTO ${receiptTable} (delivery_id, artifact_sha256, target, config_sha256, row_count) VALUES ($1, $2, $3, $4, $5)`,
      [deliveryId, digest, targetName, configDigest, gold.records.length],
    );
    await client.query("COMMIT");
    return { committed: true, rows: gold.records.length };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
