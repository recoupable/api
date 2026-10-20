# Fan comment recency through the supported fans endpoint

Tracks the fan-recency outcome in Mono #327 / App #2023. The existing authenticated
`GET /api/artists/{id}/fans` now returns an additive `last_comment_at` field on each
fan profile: the matched latest comment's `commented_at` string, or null when no
matching comment is available. Existing profiles, engagement ordering, pagination,
authentication and artist access checks remain unchanged. No extra query is added.

Example response fragment (synthetic):

```json
{
  "status": "success",
  "fans": [{ "id": "fan_fixture", "username": "fan", "last_comment_at": "2026-10-01T12:00:00Z" }],
  "pagination": { "total_count": 1, "page": 1, "limit": 20, "total_pages": 1 }
}
```

The existing `selectSocialFans` query already selects `latest_engagement_comment`
through `social_fans.latest_engagement_id`. Its existing social filter comes from
the authorized artist's account-social links. The unchanged database migration
`20250710195500_social_fans_trigger.sql` links that relationship to the newest
inserted/updated comment; this PR changes no database schema or trigger.

The projection matches the comment's `social_id` to the returned fan profile ID.
Missing or mismatched evidence yields null. It never substitutes the fan profile's
`updated_at`, the relationship's `latest_engagement` or a current timestamp. Null
means unavailable stored evidence, not proof the fan has never commented. This is
stored recency for the returned fan relationship, not a live scrape, exhaustive
cross-platform interaction history or guarantee that older stored links were
backfilled. Existing duplicate fan rows across social relationships are unchanged.

The weekly report can use this supported route's timestamp for its Last heard
column. Public ArtistFan schema follow-up: add optional nullable string/date-time
`last_comment_at`, defined as the latest stored linked comment time when known.
Update canonical Marketing docs and retained Docs together under their release
workflow; do not advertise a deployed response until exact serving readback.

This is a bounded supported alternative for fan-recency. It does not implement
`GET /api/comments`, enumerate comment bodies or add filtering by post, and does
not close all of #327 or declare the other stale operations restored. Valuation
history remains owned by existing API #795; no competing history implementation
is introduced. There are no new MCP scopes/tools or authorization changes.

Verification uses synthetic fan/comment fixtures and mocked access/data functions.
Public-handler cases exercise the real validator and projection, prove unauthorized
requests stop before fan/comment reads, and verify authorized artist-social scoping.
Domain cases preserve object/array join shapes, pagination, missing/mismatched
links and database failure behavior. No production read of customer comments,
provider call, customer write, migration or merge is part of these tests.
