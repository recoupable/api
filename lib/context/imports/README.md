# Context imports — deterministic catalog export parser

`parseCatalogExport(text)` turns the UTF-8 text of a generic catalog export CSV into **proposals**: one `catalog_export_row` per well-formed row, each with a `pointer` (1-based data row, physical source line, and the column index of every recognised field), trimmed string `claims` (track/artist/release title, release date, label, track number), shape-checked `identifiers` (`isrc`, `upc`), the unmapped columns verbatim, and the raw cells. The result also carries `parserVersion` (`catalog-export-csv-v1`), `profileVersion` (`generic-catalog-export-v1`), a `contentFingerprint` (SHA-256 of the exact input text) and a `headerFingerprint` (SHA-256 of the verbatim header cells), so a later slice can recognise an exact replay, a changed version with the same shape, or a different export layout.

## What it does not do

- It does **not** import, review, accept, link, store or expose anything. Every proposal is literally `status: "proposed"`; there is no producer for a reviewed or accepted state in this module. "Parsed" is a separate state from available/imported/reviewed.
- It does **not** establish identity, roster membership, catalog interest, rights or mandates. Claims are the customer's cell text carried as data; instruction-like text in a cell stays a plain string and produces no flag or behaviour.
- It never invents, pads or repairs an identifier. ISRC (2 letters, 3 alphanumerics, 7 digits) and UPC/EAN/GTIN (12–14 digits) are checked by shape only after removing hyphens/spaces and upper-casing; anything else is `malformed` with the raw text kept, and an empty cell is `unknown`. Check digits are not validated.
- Malformed rows (`empty_row`, `column_count_mismatch`, `unterminated_quote`) are reported with pointers beside the proposals, never dropped or fixed. Whole-input failures throw `ContextImportError` with a code (`unsupported_input`, `empty_input`, `header_missing`, `row_limit_exceeded`, `cell_limit_exceeded`) and no partial result: 10,000 data rows / 10,000 characters per cell are hard caps.
- Duplicates are signals, not deletions: `same_isrc` and `same_row_content` list the rows involved; a shared UPC is expected within one release and is not reported.
- The header profile is a small distributor-neutral alias set (see `catalogExportColumns.ts`); when two columns map to the same field the first wins and the second is retained as unmapped. Nothing distributor- or customer-specific belongs here.
- Pure: no database, HTTP, MCP, storage, provider, environment, clock or randomness. Same text in, identical result out.

## Where a later slice connects it

A retained original (api#987/#990 receipts, database#94/#95) would be read as text by the server, passed through `parseCatalogExport`, and the proposals persisted against that exact source version with their pointers and `parserVersion`/`profileVersion`, then surfaced through the shared Context operation and evidence manifest (api#983/#985). Reviewing a proposal into an assertion, staling only affected reviews when a new version arrives, and conflict resolution between versions are all owned by that follow-up; this module only provides the fingerprints and pointers it needs.

## Unsupported here

PDF, images/OCR, DDEX, royalty or sales statements, XLSX/zip containers, non-UTF-8 encodings, and any paid model extraction. These fail with `unsupported_input` (or are simply not attempted) rather than producing a proposals list.
