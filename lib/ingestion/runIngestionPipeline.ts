import Decimal from "decimal.js";
import { readIngestionRows } from "./readIngestionRows";
import { normalizeIngestionValue } from "./normalizeIngestionValue";
import { ingestionContractSchema } from "./schemas";
import { INGESTION_ENGINE_VERSION } from "./const";
import type {
  IngestionContract,
  IngestionFormat,
  PipelineResult,
  SourceRow,
  Values,
} from "./types";

/** Produce immutable silver and eligible gold; no financial rows are silently discarded. */
export async function runIngestionPipeline(
  bytes: Uint8Array,
  format: IngestionFormat,
  input: IngestionContract,
): Promise<PipelineResult> {
  const contract = ingestionContractSchema.parse(input);
  const D = Decimal.clone({ precision: 150 });
  const result: PipelineResult = {
    status: "rejected",
    silver: { records: [] },
    gold: null,
    controls: [],
    issues: [],
    issue_count: 0,
  };
  const issue = (value: PipelineResult["issues"][number]) => {
    result.issue_count++;
    if (result.issues.length < 1000) result.issues.push(value);
  };
  let rows: SourceRow[];
  try {
    rows = await readIngestionRows(bytes, format, contract);
  } catch (error) {
    const code =
      error instanceof Error && /^[A-Z_]{1,64}$/.test(error.message)
        ? error.message
        : "SOURCE_UNREADABLE_OR_UNSUPPORTED";
    issue({ code });
    return result;
  }
  if (!rows.length) {
    issue({ code: "NO_RECORDS" });
    return result;
  }
  const expected = new Set([
    ...contract.fields.flatMap(f => (f.source === undefined ? [] : [f.source])),
    ...contract.ignored_columns,
  ]);
  const keys = new Set<string>();
  for (const row of rows) {
    if (Object.keys(row.values).some(k => !expected.has(k)))
      issue({ code: "UNMAPPED_COLUMN", row: row.source_row });
    const values: Values = Object.create(null);
    for (const field of contract.fields) {
      try {
        if (field.source !== undefined && !Object.hasOwn(row.values, field.source))
          throw new Error("COLUMN_MISSING");
        values[field.name] = normalizeIngestionValue(
          field.constant ?? row.values[field.source!],
          field,
        );
      } catch {
        issue({
          code: "VALUE_INVALID_OR_MISSING",
          row: row.source_row,
          field: field.name,
        });
      }
    }
    if (
      contract.business_keys.length &&
      contract.business_keys.every(k => values[k] !== undefined && values[k] !== null)
    ) {
      const key = JSON.stringify(contract.business_keys.map(k => values[k]));
      if (keys.has(key)) issue({ code: "DUPLICATE_KEY", row: row.source_row });
      keys.add(key);
    } else if (contract.business_keys.length) issue({ code: "KEY_REQUIRED", row: row.source_row });
    result.silver.records.push({ ...row, values });
  }
  for (const control of contract.controls) {
    const records = result.silver.records.filter(r =>
      Object.entries(control.where).every(([k, v]) => r.values[k] === v),
    );
    const values = records.map(r => r.values[control.field]);
    const valid = values.every(v => typeof v === "string");
    const actual = valid
      ? values.reduce((n, value) => n.plus(value!), new D(0)).toFixed()
      : "unavailable";
    const passed = valid && new D(actual).minus(control.expected).abs().lte(control.tolerance);
    result.controls.push({ field: control.field, expected: control.expected, actual, passed });
    if (!passed) issue({ code: "CONTROL_FAILED", field: control.field });
  }
  if (result.issues.length) {
    result.status = "held";
    return result;
  }
  let records = result.silver.records.map(r => r.values);
  if (contract.aggregate) {
    const groups = new Map<string, Values>();
    for (const row of records) {
      const key = JSON.stringify(contract.aggregate.group_by.map(k => row[k]));
      const group =
        groups.get(key) ??
        Object.fromEntries([
          ...contract.aggregate.group_by.map(k => [k, row[k]]),
          ...contract.aggregate.sums.map(k => [k, "0"]),
        ]);
      for (const name of contract.aggregate.sums) {
        if (row[name] === null) {
          result.status = "held";
          issue({ code: "NULL_AGGREGATE", field: name });
          return result;
        }
        group[name] = new D(group[name]!).plus(row[name]!).toFixed();
      }
      groups.set(key, group);
    }
    records = [...groups.values()];
  }
  result.status = "ready";
  result.gold = {
    engine_version: INGESTION_ENGINE_VERSION,
    contract_version: contract.version,
    records,
    field_types: Object.fromEntries(
      contract.fields
        .filter(
          f =>
            !contract.aggregate ||
            [...contract.aggregate.group_by, ...contract.aggregate.sums].includes(f.name),
        )
        .map(f => [f.name, f.type]),
    ),
  };
  return result;
}
