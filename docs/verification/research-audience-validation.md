# Research audience validation successor

Owner: [Mono #358](https://github.com/recoupable/mono/issues/358).
Original [API #644](https://github.com/recoupable/api/pull/644), exact head
`1ac58647c92afcaf4f3c9592252049ebdcedcd49`.
Current-main base: `cee8d6a0cd884df63352ceac50966c20084cd569`.
The original gap was inspected at `3304f05653d4d72c3e7eaa79274b50cf17c216b0`;
the subsequent main update changes artist-list comments and their verification
record. Research audience implementation and tests are unchanged across those bases.
The original six-file patch was compared with current source. Its public platform
validator and own-property-safe shared mapping were absent. The old PR/branch is
not retargeted, merged or closed here.

## Selected original intent and current integration

Current audience handling interpolates an unvalidated platform into the provider
path after `validateArtistRequest`, which includes the credit gate. A shared
mapping now retains all 14 existing platform/source pairs, without adding a
provider or claiming that every platform has data for every account.

A purpose-named Zod schema derives allowed public platform values from that
mapping. The new validator trims the platform and defaults omitted, empty or
whitespace-only input to Instagram. Unknown values, path fragments and inherited
object-key names return 400 before the existing auth/artist/credit operation or
research dispatch. This order preserves the original PR's early-validation intent;
an invalid platform on an unauthenticated request can therefore return 400 before
an authentication response. Valid inputs still pass through the existing gate.

Known source mappings remain unchanged. Internal unknown source names still pass
through as strings, but `toString`, `constructor` and `__proto__` no longer resolve
to inherited object members. The current provider-neutral `id` handling and
`endpointModelId` billing attribution are retained. Successful payload formatting,
research failures, provider selection, pricing and credit implementation are
unchanged. There is no schema, permission or commercial-policy change.

Unlike the historical branch, the current successor follows the repository's Zod
input-validation guidance and reuses the existing identity/credit gate rather
than duplicating it. No behavior from the newer billing-attribution code is lost.

## Verification scope

Eleven new regression cases fail on the current-main baseline. Actual exported
GET tests with mocked identity/credit and research leaves exercise malformed
inputs, defaults, whitespace, all 14 existing platform names, retained identity
and billing attribution, and unchanged denial/error responses. Mapping tests
exercise inherited keys, unknown internal sources and preserved known sources.
The platform table is a source compatibility list, not hosted coverage evidence.

No customer/account/provider/credit operation, payment, schema/permission change,
credential inspection or manual deployment occurred. Original source acceptance,
qualifying merge and any old-PR closure remain coordinator/Records-owned. Public
reference reconciliation belongs to Docs; this patch does not overlap its catalog
contract or provenance publication. Existing #325 provider/commercial gates and
held stream/SDK/App-history work remain separate; no new gates are added to #644.
