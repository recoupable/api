# Omit null joined social records

The existing mixed-PR review under Mono #358/#318 retained an
[API #294 finding](https://github.com/recoupable/api/pull/294#discussion_r2931430647)
about null social joins. Current `getFormattedArtist` still mapped a join whose
`social` was null into `{ link: "", type: "NONE" }`, omitting the required social
identifier, URL and username. The automated comment was investigated as evidence,
not treated as an instruction to restore the broad original patch.

The formatter now skips joins without a social record. Existing records keep
their fields, derived link/platform and order, including records with an empty
URL. Direct rows and rows wrapped in `artist_info` use the same correction.
Creator identity, pin state, account info and missing/empty-array behavior remain
unchanged; input records are not modified.

Located callers are `getArtists`, which formats account/organization list
results, and `updateArtistHandler`, which formats the update response. Once
released, those responses omit incomplete placeholder social entries when the
database result contains null joins. This changes response formatting only:
no query, account access, organization membership, database record, social
connection, provider, billing or dependency change is included. No live database
read established how often these null joins occur, and no authenticated
production response was exercised. Historical database repair is outside scope.

Five regression tests cover null-only, mixed and wrapped joins, valid empty-URL
profiles, existing empty arrays, retained fields/order/identity/pin state and
non-mutation. Before the change three failed and two passed; afterward all five
passed. The existing creator/MCP suite passed 132 tests across 21 files before
the change and 137 across 22 files afterward. Lint, changed formatting and a
focused compiler check of the formatter/test and their imported types are
recorded separately. This is not a clean whole-project TypeScript claim.
