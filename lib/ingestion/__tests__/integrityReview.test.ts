import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { hashIngestionValue } from "../hashIngestionValue";
import { readIngestionManifest } from "../readIngestionManifest";
import { runIngestionPipeline } from "../runIngestionPipeline";
import { ingestionContractSchema } from "../schemas";

const scope = "account/11111111-1111-4111-8111-111111111111";
const id = "a".repeat(64);
const contract = ingestionContractSchema.parse({
  version: "1",
  fields: [{ name: "id", source: "ID", type: "string" }],
});
function workbook(row: string) {
  return zipSync({
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="Data" r:id="r1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ID</t></is></c></row><row r="2">${row}</row></sheetData></worksheet>`,
    ),
  });
}
describe("ingestion integrity boundaries", () => {
  it("bounds constant expansion before serializing a whole oversized artifact", async () => {
    const c = ingestionContractSchema.parse({
      version: "1",
      fields: [
        { name: "id", source: "ID", type: "string" },
        ...Array.from({ length: 99 }, (_, i) => ({
          name: `constant_${i}`,
          constant: "x".repeat(2000),
          type: "string",
        })),
      ],
    });
    const result = await runIngestionPipeline(
      Buffer.from("ID\n" + Array.from({ length: 100 }, (_, i) => String(i)).join("\n")),
      "csv",
      c,
    );
    expect(result.status).toBe("rejected");
    expect(result.issues).toContainEqual({ code: "OUTPUT_SIZE_LIMIT" });
    expect(result.silver.records).toHaveLength(0);
  });
  it("hashes JSON key order consistently and rejects unsupported values", () => {
    expect(hashIngestionValue({ a: 1, b: ["x", null] })).toBe(
      hashIngestionValue({ b: ["x", null], a: 1 }),
    );
    for (const v of [
      undefined,
      NaN,
      Infinity,
      new Date(),
      new Map(),
      new ArrayBuffer(4),
      new Uint8Array(4),
      1n,
    ])
      expect(() => hashIngestionValue(v)).toThrow();
  });
  it("rejects a forged manifest's cross-scope original reference", async () => {
    const manifest = {
      job_id: id,
      input_sha256: id,
      engine_version: "1",
      scope,
      format: "csv",
      filename: "data.csv",
      bronze_key: `account/22222222-2222-4222-8222-222222222222/originals/${id}`,
      bronze_sha256: id,
      source: { kind: "inline" },
      contract,
      created_at: new Date().toISOString(),
    };
    const store = {
      read: async () => Buffer.from(JSON.stringify(manifest)),
      create: async () => false,
    };
    await expect(readIngestionManifest(store, scope, id)).rejects.toThrow(
      "Invalid ingestion manifest",
    );
    await expect(readIngestionManifest(store, "invalid", id)).rejects.toThrow("Invalid scope");
  });
  it("does not approve an unmatched zero-valued control", async () => {
    const c = ingestionContractSchema.parse({
      version: "1",
      fields: [
        { name: "currency", source: "Currency", type: "string" },
        { name: "amount", source: "Amount", type: "decimal" },
      ],
      controls: [{ field: "amount", expected: "0", where: { currency: "USD" } }],
    });
    const result = await runIngestionPipeline(Buffer.from("Currency,Amount\nEUR,1"), "csv", c);
    expect(result.status).toBe("held");
    expect(result.controls[0].passed).toBe(false);
  });
  it("selects a physical CSV header after blank lines and differently shaped preambles", async () => {
    const c = ingestionContractSchema.parse({ ...contract, header_row: 3 });
    const result = await runIngestionPipeline(Buffer.from("Title,Report\n\nID\n001"), "csv", c);
    expect(result.status).toBe("ready");
    expect(result.silver.records[0].source_row).toBe(4);
    expect(result.gold?.records).toEqual([{ id: "001" }]);
  });
  it("rejects invalid native spreadsheet booleans even when the mapped field is text", async () => {
    const result = await runIngestionPipeline(
      workbook('<c r="A2" t="b"><v>2</v></c>'),
      "xlsx",
      contract,
    );
    expect(result.status).toBe("rejected");
    expect(result.issues[0].code).toBe("CELL_TYPE_UNSUPPORTED");
  });
  it("accepts styled blank spreadsheet cells beyond the mapped header", async () => {
    const result = await runIngestionPipeline(
      workbook('<c r="A2" t="inlineStr"><is><t>001</t></is></c><c r="B2" s="1"/>'),
      "xlsx",
      contract,
    );
    expect(result.status).toBe("ready");
    expect(result.gold?.records).toEqual([{ id: "001" }]);
  });
  it("refuses line-break PDF separators during contract validation", () => {
    for (const separator of ["\n", "\r", "|\n"])
      expect(() =>
        ingestionContractSchema.parse({
          ...contract,
          text_table: { review_ref: "review", separator },
        }),
      ).toThrow();
  });
});
