# Release players

Implementation pending release. This is a reusable API-owned feature, not a Gatsby-specific integration.

- Authenticated `/api/players` HTTP operations and `*_release_player` MCP tools share `lib/players/processPlayerOperation`.
- A registered player owns artist/workspace attribution, Spotify/Apple destinations, branding, exact embed origins and revision. It is disabled by default. Enabling requires the existing paid workspace entitlement.
- The app serves `/listen/{playerId}` plus `/listen/{playerId}/{spotify|apple_music}`. These are thin browser renderers over public API configuration; SDK playback must execute in a trusted browser.
- API public configuration creates/resumes a signed, provider-bound session. The API exchanges Spotify PKCE codes and confirms `/v1/me`, then atomically binds available email/profile and scopes to the registered artist/workspace.
- Provider credentials are kept in the trusted Recoup browser session. They never reach the external artist website or fan database. Apple sessions are anonymous and do not capture email.
- Reported listening includes track/play/pause/skip/stop and bounded active duration. Idempotent event IDs and serialized server duration checks prevent duplicate retries and unbounded time accumulation. These are browser observations, not DSP stream totals or causal uplift.
- Fans persist across releases for the same artist and workspace. Sign-in does not grant marketing consent; existing explicit email updates signups remain separate.

## Dependencies and activation

1. Review/apply database migrations `20261010060000_release_players.sql` `20261010060001_release_player_reports.sql` and `20261010060002_player_duration_budget.sql` in order.
2. Release API and app PRs. API needs its existing `SITES_SPOTIFY_CLIENT_ID`, signing credentials and Apple developer keys. Optional `PLAYER_APP_ORIGIN` defaults to `https://app.recoupable.dev`; Spotify must register that origin's `/s/spotify/callback` on the same developer app. Optional `PLAYER_SESSION_SECRET` uses an isolated signer; otherwise the API's service role key is used with a separate signing context. No app-side Spotify client ID is needed for the new player.
3. Register the artist's destinations and exact website origins through the authenticated API/MCP. Explicitly enable the player after reviewing configuration.
4. Use the returned listen/embed links, passing bounded `source`, `medium`, `campaign`, `content` labels.
5. Verify real Spotify/Apple authorization and browser playback, saved fan readback, event readback, and direct DSP fallback on mobile. Tests and visual fixtures do not establish live provider playback.
6. Gatsby consumes `NEXT_PUBLIC_RECOUP_PLAYER_ID` and a separate `NEXT_PUBLIC_RECOUP_WISH_PLAYER_ID`. Missing IDs retain direct DSP handoff rather than displaying fake authentication.

## Validation

API unit tests exercise ownership, paid publication, revisions, safe destinations/origins, signed sessions, confirmed scopes/profile capture, provider-bound reporting and private fan/activity access. The database PR runs real PostgreSQL identity, isolation, deduplication, concurrent retry and duration tests. App tests cover trusted renderers, PKCE session transport, observed active duration and unchanged legacy Sites behavior.

No production migration, real fan authorization or playback has been performed for this version. Records must be registered after the dependent releases; documentation alone does not activate players.

Apple Music browser tokens currently support the default app.recoupable.dev origin only. A custom PLAYER_APP_ORIGIN supports Spotify; Apple needs a matching signer configuration before enabling its player there.
