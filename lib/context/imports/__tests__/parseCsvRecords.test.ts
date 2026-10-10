import { describe, expect, it } from "vitest";
import { ContextImportError } from "../ContextImportError";
import { CSV_MAX_CELL_LENGTH, CSV_MAX_ROWS } from "../csvRecordTypes";
import { parseCsvRecords } from "../parseCsvRecords";

describe("parseCsvRecords", () => {
  it("tokenizes a LF file into a header and rows with row and line pointers", () => {
    const records = parseCsvRecords("title,artist\nSong One,Artist A\nSong Two,Artist B\n");
    expect(records.header).toEqual(["title", "artist"]);
    expect(records.rows).toEqual([
      { rowNumber: 1, line: 2, cells: ["Song One", "Artist A"] },
      { rowNumber: 2, line: 3, cells: ["Song Two", "Artist B"] },
    ]);
    expect(records.malformed).toEqual([]);
  });

  it("handles CRLF terminators, quoted commas, escaped quotes and embedded newlines", () => {
    const text =
      'title,notes\r\n"Song, One","She said ""hi"""\r\n"Multi\nline",plain\r\nLast,row\r\n';
    const records = parseCsvRecords(text);
    expect(records.header).toEqual(["title", "notes"]);
    expect(records.rows).toEqual([
      { rowNumber: 1, line: 2, cells: ["Song, One", 'She said "hi"'] },
      { rowNumber: 2, line: 3, cells: ["Multi\nline", "plain"] },
      // The embedded newline consumed a physical line, so the next record starts on line 5.
      { rowNumber: 3, line: 5, cells: ["Last", "row"] },
    ]);
    expect(records.malformed).toEqual([]);
  });

  it("strips a leading byte-order mark from the first header cell only", () => {
    const records = parseCsvRecords("\uFEFFisrc,title\nZZTST2600001,Song\n");
    expect(records.header).toEqual(["isrc", "title"]);
    expect(records.rows[0]?.cells).toEqual(["ZZTST2600001", "Song"]);
  });

  it("returns an empty header for empty input and no rows for a header-only file", () => {
    expect(parseCsvRecords("")).toEqual({ header: [], rows: [], malformed: [] });
    expect(parseCsvRecords("title,artist")).toEqual({
      header: ["title", "artist"],
      rows: [],
      malformed: [],
    });
    expect(parseCsvRecords("title,artist\r\n")).toEqual({
      header: ["title", "artist"],
      rows: [],
      malformed: [],
    });
  });

  it("reports interior blank rows as malformed without dropping their row number", () => {
    const records = parseCsvRecords("title,artist\nSong One,Artist A\n\n , \nSong Two,Artist B\n");
    expect(records.rows).toEqual([
      { rowNumber: 1, line: 2, cells: ["Song One", "Artist A"] },
      { rowNumber: 4, line: 5, cells: ["Song Two", "Artist B"] },
    ]);
    expect(records.malformed).toEqual([
      { rowNumber: 2, line: 3, reason: "empty_row", cells: [""] },
      { rowNumber: 3, line: 4, reason: "empty_row", cells: [" ", " "] },
    ]);
  });

  it("marks rows whose column count differs from the header as malformed and keeps the rest", () => {
    const records = parseCsvRecords(
      "title,artist,isrc\nSong One,Artist A,ZZTST2600001\nSong Two,Artist B\nSong Three,Artist C,ZZTST2600003,extra\nSong Four,Artist D,ZZTST2600004\n",
    );
    expect(records.rows.map(row => row.rowNumber)).toEqual([1, 4]);
    expect(records.malformed).toEqual([
      { rowNumber: 2, line: 3, reason: "column_count_mismatch", cells: ["Song Two", "Artist B"] },
      {
        rowNumber: 3,
        line: 4,
        reason: "column_count_mismatch",
        cells: ["Song Three", "Artist C", "ZZTST2600003", "extra"],
      },
    ]);
  });

  it("reports an unterminated quote as malformed and leaves earlier rows intact", () => {
    const records = parseCsvRecords(
      'title,artist\nSong One,Artist A\n"Song Two,Artist B\nSong Three,Artist C\n',
    );
    expect(records.rows).toEqual([{ rowNumber: 1, line: 2, cells: ["Song One", "Artist A"] }]);
    expect(records.malformed).toHaveLength(1);
    expect(records.malformed[0]).toMatchObject({
      rowNumber: 2,
      line: 3,
      reason: "unterminated_quote",
    });
  });

  it("treats a quote inside an unquoted field as a literal character", () => {
    const records = parseCsvRecords('title,artist\n12" Mix,Artist A\n');
    expect(records.rows[0]?.cells).toEqual(['12" Mix', "Artist A"]);
  });

  it("refuses files above the row cap with an explicit error instead of a partial result", () => {
    const text = `title,artist\n${Array.from({ length: 3 }, (_, i) => `Song ${i},Artist`).join("\n")}\n`;
    expect(parseCsvRecords(text, { maxRows: 3 }).rows).toHaveLength(3);
    let caught: unknown;
    try {
      parseCsvRecords(text, { maxRows: 2 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContextImportError);
    expect((caught as ContextImportError).code).toBe("row_limit_exceeded");
    expect(CSV_MAX_ROWS).toBe(10_000);
    const oversized = `title\n${Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) => `Song ${i}`).join("\n")}\n`;
    expect(() => parseCsvRecords(oversized)).toThrow(ContextImportError);
  });

  it("refuses cells above the cell length cap with an explicit error", () => {
    expect(() => parseCsvRecords(`title\n${"x".repeat(11)}\n`, { maxCellLength: 10 })).toThrow(
      expect.objectContaining({ code: "cell_limit_exceeded" }),
    );
    expect(parseCsvRecords(`title\n${"x".repeat(10)}\n`, { maxCellLength: 10 }).rows).toHaveLength(
      1,
    );
    expect(CSV_MAX_CELL_LENGTH).toBe(10_000);
    expect(() => parseCsvRecords(`title\n${"x".repeat(CSV_MAX_CELL_LENGTH + 1)}\n`)).toThrow(
      ContextImportError,
    );
  });

  it("reports a header that never closes its quote as a header-level malformed record", () => {
    const records = parseCsvRecords('"title,artist\nSong One,Artist A\n');
    expect(records.header).toEqual([]);
    expect(records.rows).toEqual([]);
    expect(records.malformed).toEqual([
      {
        rowNumber: 0,
        line: 1,
        reason: "unterminated_quote",
        cells: ["title,artist\nSong One,Artist A\n"],
      },
    ]);
  });
  it("reports text after a closing quote as malformed and keeps the literal source cell", () => {
    const records = parseCsvRecords(
      'title,artist\n"Heroes" (Live),Artist A\n"x"y,z\n"Spaced" ,Artist C\nSong Four,Artist D\n',
    );
    expect(records.rows).toEqual([{ rowNumber: 4, line: 5, cells: ["Song Four", "Artist D"] }]);
    expect(records.malformed).toEqual([
      {
        rowNumber: 1,
        line: 2,
        reason: "text_after_closing_quote",
        cells: ['"Heroes" (Live)', "Artist A"],
      },
      { rowNumber: 2, line: 3, reason: "text_after_closing_quote", cells: ['"x"y', "z"] },
      {
        rowNumber: 3,
        line: 4,
        reason: "text_after_closing_quote",
        cells: ['"Spaced" ', "Artist C"],
      },
    ]);
  });

  it("still accepts a properly closed quoted cell followed by a delimiter or end of input", () => {
    const records = parseCsvRecords('title,artist\n"Song","Artist"\r\n"Last","Row"');
    expect(records.rows).toEqual([
      { rowNumber: 1, line: 2, cells: ["Song", "Artist"] },
      { rowNumber: 2, line: 3, cells: ["Last", "Row"] },
    ]);
    expect(records.malformed).toEqual([]);
  });

  it("reports an unterminated quote at its opening line even when more than a cell of text follows", () => {
    const tail = Array.from({ length: 20 }, (_, i) => `x${i},y`).join("\n");
    const records = parseCsvRecords(
      `title,artist\nSong One,Artist A\n"Song Two,Artist B\n${tail}\n`,
      {
        maxCellLength: 10,
      },
    );
    expect(records.rows).toEqual([{ rowNumber: 1, line: 2, cells: ["Song One", "Artist A"] }]);
    expect(records.malformed).toEqual([
      {
        rowNumber: 2,
        line: 3,
        reason: "unterminated_quote",
        cells: [`Song Two,Artist B\n${tail}\n`],
      },
    ]);
    const realistic = `isrc,title\n"ZZTST2600001,Song\n${"x,y\n".repeat(3_000)}`;
    expect(parseCsvRecords(realistic).malformed).toMatchObject([
      { rowNumber: 1, line: 2, reason: "unterminated_quote" },
    ]);
  });

  it("names the starting line when a quoted cell that does close exceeds the cell cap", () => {
    const text = `title,artist\nSong One,Artist A\n"${"line\n".repeat(5)}",Artist B\n`;
    expect(() => parseCsvRecords(text, { maxCellLength: 10 })).toThrow(
      expect.objectContaining({
        code: "cell_limit_exceeded",
        message: expect.stringContaining("starting on line 3"),
      }),
    );
  });

  it("does not report blank lines at the end of the file as malformed rows", () => {
    for (const text of ["a,b\n1,2\n\n", "a,b\r\n1,2\r\n\r\n\r\n", "a,b\n1,2\n\n\n"]) {
      const records = parseCsvRecords(text);
      expect(records.rows).toEqual([{ rowNumber: 1, line: 2, cells: ["1", "2"] }]);
      expect(records.malformed).toEqual([]);
    }
    expect(parseCsvRecords("a,b\n\n\n").rows).toEqual([]);
    expect(parseCsvRecords("a,b\n\n\n").malformed).toEqual([]);
    expect(parseCsvRecords("a,b\n\n1,2\n\n").malformed).toEqual([
      { rowNumber: 1, line: 2, reason: "empty_row", cells: [""] },
    ]);
  });

  it("refuses a record with more columns than the column cap", () => {
    expect(() => parseCsvRecords(`a,b\n${",".repeat(5)}\n`, { maxColumns: 5 })).toThrow(
      expect.objectContaining({ code: "column_limit_exceeded" }),
    );
    expect(() => parseCsvRecords(`${",".repeat(5)}\n`, { maxColumns: 5 })).toThrow(
      expect.objectContaining({ code: "column_limit_exceeded" }),
    );
    expect(parseCsvRecords(`a,b,c,d,e\n${",".repeat(4)}\n`, { maxColumns: 5 }).malformed).toEqual([
      { rowNumber: 1, line: 2, reason: "empty_row", cells: ["", "", "", "", ""] },
    ]);
    expect(() => parseCsvRecords(`title\n${",".repeat(2_000_000)}\n`)).toThrow(
      expect.objectContaining({ code: "column_limit_exceeded" }),
    );
  });
});
