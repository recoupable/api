# Catalog CSV escaping

The existing mixed-PR reconciliation under Mono #358/#318 found the same CSV
escaping issue in [API #294 review](https://github.com/recoupable/api/pull/294#discussion_r2931430653)
and [API #295 review](https://github.com/recoupable/api/pull/295#discussion_r2932043198).
Current `formatCatalogSongsAsCSV` still surrounded names with quotes without
escaping quotes within them. For example, `He Said "Go"` produced a malformed field.
Those automated review comments are evidence to investigate, not instructions to
restore either broad patch.

The formatter now doubles embedded quotes in quoted fields. Song, release and
joined creator names retain their existing quoted layout. Identifiers retain
their existing unquoted layout unless they contain a comma, quote or line break.
Empty output, row order, creator order, line separators and existing null
conversion remain unchanged. Input objects are not modified.

The located consumer is `getCatalogDataAsCSV` → `CatalogAvailability`, an AI
evaluation scorer. This changes serialization of its catalog input, not catalog
storage, retrieval, authorization, model selection, scoring rules or billing.
No catalog fetch or paid scorer run was performed; improved scoring accuracy is
not established. This is not a general spreadsheet-safety or export redesign.

Ten fixed-output tests cover ordinary rows, empty catalogs, quotes in all three
name fields, identifiers containing CSV delimiters, embedded line breaks and
legacy null handling. Before the fix, six failed and four passed. Afterward all
ten passed; the broader catalog suite passed 242 tests across 32 files. Existing
catalog tests passed 232 tests across 31 files before this change. Lint and
changed-file formatting are checked separately. No new dependency is required.

Only this confirmed formatter issue is selected from the mixed-PR review. The
original content/WhatsApp removals, callback identity changes, provider changes
and new campaign endpoint remain outside this repair. It does not establish
completion of the full 119-PR review or of any live customer journey.
