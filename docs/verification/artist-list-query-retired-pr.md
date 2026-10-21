# Artist-list query documentation from API #217

Owner: [Mono #358](https://github.com/recoupable/mono/issues/358).
Original: [API #217](https://github.com/recoupable/api/pull/217), exact head
`90ba05c5c9c9410afcabbc04c389932284b6b54d`, still targeting retired `test`.
Inspected current-main baseline: `1703112ca52f816ded40a544f6bb988d0c5a9e41`.

The original requested auth-derived artist listing, personal artists by default,
and removal of the legacy `personal` parameter. The current
`validateGetArtistsRequest` already authenticates with `validateAuthContext`,
parses only `account_id` and `org_id`, and passes them to `buildGetArtistsParams`.
That builder defaults an omitted organization filter to `null` for personal
artists and checks account overrides with `canAccessAccount`.

The maintained Marketing reference at
`fbfef975ebc8be09db5a3abb9a1dfef67252bb9b` already documents those current
parameters and the personal default. The route and handler JSDoc still advertised
retired parameter names, `personal=true` or the old all-artists default. The
handler, validator and builder also described account overrides by key class
rather than the existing access check. This successor reconciles the comments
across all four entry points. It changes no executable statement, schema,
permission or public input.

Verify the comment-only TypeScript diff with `git diff --check` and the required
`pnpm lint`. Existing runtime tests remain unchanged; no new unit case is needed
for comments. Independent review and current-head CI belong to this successor.
This does not verify the original CLI/curl test plan, accept every original
requirement as hosted, retarget or close the old PR, or complete the #358 inventory.
