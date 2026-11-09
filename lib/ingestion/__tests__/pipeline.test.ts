import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { runIngestionPipeline } from "../runIngestionPipeline";
import { ingestionContractSchema } from "../schemas";

const contract = ingestionContractSchema.parse({
  version: "1",
  fields: [
    { name: "id", source: "ID", type: "string" },
    { name: "amount", source: "Amount", type: "decimal" },
  ],
  business_keys: ["id"],
  controls: [{ field: "amount", expected: "0.3" }],
});
const run = (text: string, format = "csv", rules = contract) =>
  runIngestionPipeline(Buffer.from(text), format as "csv", rules);

describe("medallion processing", () => {
  it("holds a required identifier that becomes blank after explicit trimming", async () => {
    const rules = ingestionContractSchema.parse({
      ...contract,
      fields: contract.fields.map(f => ({ ...f, trim: true })),
    });
    const result = await run('ID,Amount\n"   ",0.3', "csv", rules);
    expect(result.status).toBe("held");
    expect(result.gold).toBeNull();
    expect(result.issues).toContainEqual({ code: "VALUE_INVALID_OR_MISSING", row: 2, field: "id" });
  });
  it("normalizes explicitly trimmed blanks to null consistently across field types", async () => {
    const rules = ingestionContractSchema.parse({
      version: "1",
      fields: [
        { name: "id", source: "ID", type: "string", trim: true, nullable: true },
        { name: "amount", source: "Amount", type: "decimal", trim: true, nullable: true },
      ],
    });
    const result = await run('ID,Amount\n"   ","   "', "csv", rules);
    expect(result.status).toBe("ready");
    expect(result.gold?.records).toEqual([{ id: null, amount: null }]);
  });
  it("preserves identifiers, source coordinates and exact decimal control totals", async () => {
    const result = await run("ID,Amount\n001,0.1\n002,0.2\n");
    expect(result.status).toBe("ready");
    expect(result.silver.records[0]).toMatchObject({
      source_row: 2,
      values: { id: "001", amount: "0.1" },
    });
    expect(result.gold?.records).toEqual([
      { id: "001", amount: "0.1" },
      { id: "002", amount: "0.2" },
    ]);
    expect(result.controls[0]).toMatchObject({ actual: "0.3", passed: true });
  });
  it("handles quoted multiline cells without shifting source record identity", async () => {
    const result = await run('ID,Amount\n"a\nb",0.3\n');
    expect(result.gold?.records[0].id).toBe("a\nb");
  });
  it("retains physical CSV line coordinates after multiline records and blank lines", async () => {
    const result = await run('ID,Amount\n"a\nb",0.1\n\nc,0.2\n');
    expect(result.silver.records.map(r => r.source_row)).toEqual([2, 5]);
  });
  it("holds the entire publication for bad money, duplicate keys or schema drift", async () => {
    for (const text of [
      "ID,Amount\n001,oops",
      "ID,Amount\n001,0.1\n001,0.2",
      "ID,Amount,New\n001,0.3,x",
    ]) {
      const result = await run(text);
      expect(result.status).toBe("held");
      expect(result.gold).toBeNull();
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
  it("holds control mismatches and never coerces invalid values to zero", async () => {
    const result = await run("ID,Amount\n001,0.4");
    expect(result.controls[0].passed).toBe(false);
    expect(result.gold).toBeNull();
  });
  it("does not discard extra cells or repeated headers", async () => {
    expect((await run("ID,Amount\n001,0.3,extra")).status).toBe("rejected");
    expect((await run("ID,ID\n001,0.3")).status).toBe("rejected");
  });
  it("retains JSON numeric lexemes beyond JavaScript integer precision", async () => {
    const rules = ingestionContractSchema.parse({
      version: "1",
      fields: [{ name: "id", source: "id", type: "string" }],
    });
    const result = await run('[{"id":9007199254740993}]', "json", rules);
    expect(result.gold?.records[0].id).toBe("9007199254740993");
  });
  it("rejects nested objects rather than inventing string meanings", async () => {
    const rules = ingestionContractSchema.parse({
      version: "1",
      fields: [{ name: "id", source: "id", type: "string" }],
    });
    expect((await run('[{"id":{"x":1}}]', "json", rules)).status).toBe("rejected");
  });
  it("supports reviewed renames, constants, grouping and exact sums", async () => {
    const rules = ingestionContractSchema.parse({
      version: "1",
      fields: [
        { name: "region", source: "Region", type: "string" },
        { name: "revenue", source: "Revenue", type: "decimal" },
        { name: "currency", constant: "USD", type: "string" },
      ],
      aggregate: { group_by: ["region", "currency"], sums: ["revenue"] },
    });
    const result = await run("Region,Revenue\nUS,0.1\nUS,0.2", "csv", rules);
    expect(result.gold?.records).toEqual([{ region: "US", currency: "USD", revenue: "0.3" }]);
  });
  it("rejects invalid contract references and source mapping ambiguity", () => {
    expect(() =>
      ingestionContractSchema.parse({ ...contract, business_keys: ["missing"] }),
    ).toThrow();
    expect(() =>
      ingestionContractSchema.parse({
        ...contract,
        fields: [contract.fields[0], contract.fields[0]],
      }),
    ).toThrow();
  });
  it("never reports an empty input as ready", async () => {
    expect((await run("ID,Amount\n")).status).toBe("rejected");
  });
  it("reads native spreadsheet numeric lexemes without losing leading-zero text", async () => {
    const file = zipSync({
      "xl/workbook.xml": strToU8(
        '<workbook><sheets><sheet name="Data" r:id="r1"/></sheets></workbook>',
      ),
      "xl/_rels/workbook.xml.rels": strToU8(
        '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ID</t></is></c><c r="B1" t="inlineStr"><is><t>Amount</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>001</t></is></c><c r="B2"><v>0.3</v></c></row></sheetData></worksheet>',
      ),
    });
    const result = await runIngestionPipeline(file, "xlsx", contract);
    expect(result.gold?.records).toEqual([{ id: "001", amount: "0.3" }]);
    expect(result.silver.records[0].source_sheet).toBe("Data");
  });
  it("returns identical output artifacts on rerun", async () => {
    expect(await run("ID,Amount\n001,0.3")).toEqual(await run("ID,Amount\n001,0.3"));
  });
});
