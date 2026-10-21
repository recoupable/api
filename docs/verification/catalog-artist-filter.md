# Catalog creator filter successor

Owner: [Mono #358](https://github.com/recoupable/mono/issues/358).
Original implementation: [API #688](https://github.com/recoupable/api/pull/688),
head `adc40182726f41fd4ea073f9b972b4e83b11d6df`.
Current-main base: `1703112ca52f816ded40a544f6bb988d0c5a9e41`.
The original gap was inspected at `5a070968c4f1ee4c85486e1158f5cb39ef0a8b9f`;
the subsequent main update changes only reviewer instructions and their verification
record. The catalog adapter and its consumers are unchanged across those bases.
The original one-file patch was compared with the complete current adapter;
its two repairs were still absent. This successor does not retarget or close
that PR, complete the historical inventory or activate valuation history.

## Problem and repair

`selectCatalogSongsWithArtists` filters
`songs.song_artists.accounts.name` but originally used left joins for both
embedded creator relations. Supabase's documented left-join behavior retains
parent rows even when a related filter matches nothing. A client that retries
without its active creator filter only when `total_count` is zero can therefore
miss that fallback. Separately, a missing account embed could appear as `null`
in the public `artists` array.

Use `song_artists!inner` and `accounts!inner` only when `artistName` is provided.
The existing `songs!inner` remains. With no creator filter, keep left joins so
songs without a linked creator remain eligible. Remove null account embeds from
returned artist arrays. Catalog/ISRC filters, order, pagination, exact-count
request, error behavior, authorization and other call sites remain unchanged.
No post-fetch song filtering is added: it would not repair database pagination
or its exact count.

Semantics reference: [Supabase join types and modifiers](https://supabase.com/docs/guides/database/joins-and-nesting#join-types-and-join-modifiers),
checked October 21, 2026. The public changelog was also checked; no relevant
join-syntax breaking change was identified. No package version is changed.

## Evidence and limits

The regression suite calls the actual adapter and installed Supabase client,
replacing only the client's fetch with a synthetic response. It checks the
serialized select/filter/range/order/count request, matching and zero-result
response mapping, unfiltered artist-less tracks, null account removal, missing
relations and propagated query errors. Three tests fail on the original source;
all six pass with the repair. The zero-result body is synthetic: these tests do
not execute PostgREST or prove that a deployed database applies the joins.

Original PR #688 reports a historical real-catalog preview result; that is its
owner's dated evidence, not a customer test performed by this successor. No
customer/database/provider request, schema or permission change, credential
inspection, valuation activation or manual deployment occurred. Hosted catalog
fallback/rendering remains unverified here. Source merge and any old-PR closure
remain coordinator-owned decisions.
