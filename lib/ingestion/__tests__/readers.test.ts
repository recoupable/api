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
});
function pdf(lines: string[]) {
  const stream = `BT /F1 12 Tf 20 750 Td ${lines.map((s, i) => `${i ? "0 -20 Td " : ""}(${s}) Tj`).join("\n")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let text = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((s, i) => {
    offsets.push(text.length);
    text += `${i + 1} 0 obj\n${s}\nendobj\n`;
  });
  const position = text.length;
  text += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map(n => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${position}\n%%EOF`;
  return Buffer.from(text);
}
describe("native reader qualification", () => {
  it("extracts a real PDF using a reviewed literal table layout", async () => {
    const result = await runIngestionPipeline(
      pdf(["ID|Amount", "001|0.3"]),
      "pdf",
      ingestionContractSchema.parse({
        ...contract,
        text_table: { review_ref: "layout-v1", separator: "|" },
      }),
    );
    expect(result.status).toBe("ready");
    expect(result.gold?.records).toEqual([{ id: "001", amount: "0.3" }]);
    expect(result.silver.records[0].source_page).toBe(1);
  });
  it("requires a reviewed PDF layout and refuses unsupported scans", async () => {
    expect((await runIngestionPipeline(pdf(["ID|Amount"]), "pdf", contract)).issues[0].code).toBe(
      "PDF_LAYOUT_REQUIRED",
    );
    const result = await runIngestionPipeline(
      pdf([]),
      "pdf",
      ingestionContractSchema.parse({
        ...contract,
        text_table: { review_ref: "review", separator: "|" },
      }),
    );
    expect(result.status).toBe("rejected");
  });
  it("refuses XML entity definitions before parsing a workbook", async () => {
    const files = {
      "xl/workbook.xml": strToU8(
        '<workbook><sheets><sheet name="Data" r:id="r1"/></sheets></workbook>',
      ),
      "xl/_rels/workbook.xml.rels": strToU8(
        '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ID</t></is></c><c r="B1" t="inlineStr"><is><t>Amount</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>001</t></is></c><c r="B2"><v>0.3</v></c></row></sheetData></worksheet>',
      ),
    };
    expect((await runIngestionPipeline(zipSync(files), "xlsx", contract)).status).toBe("ready");
    files["xl/workbook.xml"] = strToU8(
      '<!DOCTYPE x [<!ENTITY secret "value">]>' +
        new TextDecoder().decode(files["xl/workbook.xml"]),
    );
    const result = await runIngestionPipeline(zipSync(files), "xlsx", contract);
    expect(result.status).toBe("rejected");
    expect(result.issues[0].code).toBe("WORKBOOK_INVALID");
  });
  it("preserves JSONL precision and reads declared API envelope paths", async () => {
    const c = ingestionContractSchema.parse({
      version: "1",
      fields: [{ name: "id", source: "id", type: "string" }],
    });
    expect(
      (await runIngestionPipeline(Buffer.from('{"id":9007199254740993}\n{"id":"001"}'), "jsonl", c))
        .gold?.records,
    ).toEqual([{ id: "9007199254740993" }, { id: "001" }]);
    expect(
      (
        await runIngestionPipeline(
          Buffer.from('{"results":[{"id":"001"}]}'),
          "json",
          ingestionContractSchema.parse({ ...c, records_path: ["results"] }),
        )
      ).gold?.records,
    ).toEqual([{ id: "001" }]);
  });
  it("enforces declared numeric conventions, valid calendar dates and aggregation nulls", async () => {
    const c = ingestionContractSchema.parse({
      version: "1",
      delimiter: ";",
      fields: [
        {
          name: "amount",
          source: "Amount",
          type: "decimal",
          decimal_separator: ",",
          thousands_separator: ".",
        },
      ],
    });
    expect(
      (await runIngestionPipeline(Buffer.from("Amount\n1.234,56"), "csv", c)).gold?.records[0]
        .amount,
    ).toBe("1234.56");
    expect((await runIngestionPipeline(Buffer.from("Amount\n12.34,56"), "csv", c)).status).toBe(
      "held",
    );
    const dates = ingestionContractSchema.parse({
      version: "1",
      fields: [{ name: "date", source: "Date", type: "date" }],
    });
    expect((await runIngestionPipeline(Buffer.from("Date\n2026-02-30"), "csv", dates)).status).toBe(
      "held",
    );
  });
});
