import { describe, expect, it } from "vitest";
import { formatCatalogSongsAsCSV } from "../formatCatalogSongsAsCSV";
import type { CatalogSong } from "../getCatalogSongs";

function song(overrides: Partial<CatalogSong> = {}): CatalogSong {
  return {
    isrc: "USABC2600001",
    name: "First Light",
    album: "Daybreak",
    artwork_url: null,
    notes: null,
    updated_at: "2026-10-22T00:00:00Z",
    catalog_id: "catalog-1",
    artists: [{ id: "creator-1", name: "River", timestamp: 1792627200000 }],
    ...overrides,
  };
}

describe("formatCatalogSongsAsCSV", () => {
  it("keeps empty catalogs empty", () => {
    expect(formatCatalogSongsAsCSV([])).toBe("");
  });

  it("preserves ordinary rows, creator order and the existing headerless layout", () => {
    expect(
      formatCatalogSongsAsCSV([
        song({ artists: [...song().artists, { ...song().artists[0], name: "Sky" }] }),
        song({ isrc: "USABC2600002", name: "Afterglow", artists: [] }),
      ]),
    ).toBe(
      'USABC2600001,"First Light","Daybreak","River, Sky"\nUSABC2600002,"Afterglow","Daybreak",""',
    );
  });

  it("escapes quotation marks inside song titles", () => {
    expect(formatCatalogSongsAsCSV([song({ name: 'He Said "Go"' })])).toBe(
      'USABC2600001,"He Said ""Go""","Daybreak","River"',
    );
  });

  it("escapes quotation marks inside release names", () => {
    expect(formatCatalogSongsAsCSV([song({ album: 'The "Live" Sessions' })])).toBe(
      'USABC2600001,"First Light","The ""Live"" Sessions","River"',
    );
  });

  it("escapes quotation marks inside joined creator names", () => {
    expect(
      formatCatalogSongsAsCSV([
        song({
          artists: [
            { ...song().artists[0], name: 'River "R"' },
            { ...song().artists[0], name: "Sky" },
          ],
        }),
      ]),
    ).toBe('USABC2600001,"First Light","Daybreak","River ""R"", Sky"');
  });

  it.each([
    ["value,with,commas", '"value,with,commas"'],
    ['value"with"quotes', '"value""with""quotes"'],
    ["value\r\nwith lines", '"value\r\nwith lines"'],
  ])("quotes an identifier containing CSV delimiters: %j", (isrc, encoded) => {
    expect(formatCatalogSongsAsCSV([song({ isrc })])).toBe(
      `${encoded},"First Light","Daybreak","River"`,
    );
  });

  it("preserves commas and line breaks within already quoted names", () => {
    expect(
      formatCatalogSongsAsCSV([song({ name: "First, Light\r\nLive", album: "Day\nBreak" })]),
    ).toBe('USABC2600001,"First, Light\r\nLive","Day\nBreak","River"');
  });

  it("preserves existing null conversion without changing input records", () => {
    const input = [
      song({ name: null, album: null, artists: [{ ...song().artists[0], name: null }] }),
    ];
    const before = structuredClone(input);
    expect(formatCatalogSongsAsCSV(input)).toBe('USABC2600001,"null","null",""');
    expect(input).toEqual(before);
  });
});
