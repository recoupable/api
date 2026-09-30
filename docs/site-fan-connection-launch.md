# Site fan connection rollout

Implemented API path: customer API key → owned site with artist → paid activation → public agreement page → Spotify PKCE → atomic fan records → registered return URL.

## Release dependencies

1. Apply database migration `20260928010000_site_fan_connections.sql` before activating this API.
2. Register `https://api.recoupable.dev/api/sites/spotify/callback` in the Recoup Spotify app. Set `SITES_FAN_SPOTIFY_REDIRECT_URI` to that exact callback and use the app's `SITES_SPOTIFY_CLIENT_ID`. Keep the existing playback callback unchanged. Preview testing needs its own registered HTTPS callback.
3. Spotify fan connection is included in an active paid Recoup subscription. No billing-policy environment variable or add-on purchase is required. The owning workspace account must own the subscription.
4. Deploy API, then publish the companion skill and API guide.
5. With a real customer credential and authorized test fan, configure a site, follow its returned link, accept, finish Spotify authorization, and verify `GET /api/sites/{id}/fans` contains that fan's connection, actual scopes and exact accepted marketing text. Try cancel and repeat connection. Unit tests and SQL tests are not evidence of live Spotify completion.

## Agent contract

Private calls use `x-api-key` or existing bearer authentication. `GET /api/sites/{id}/fan-connection` returns settings and revision. `PUT` accepts `{returnUrl,marketingText,enabled,revision}`. Use revision 0 if settings are absent. Concurrent changes return 409; reload before updating. Return URLs must be HTTPS without credentials or fragment. Enabling requires an attributed artist, valid provider configuration and paid eligibility. Return value includes the public `connectUrl`.

The site embeds only that public URL. No customer key or provider token belongs in site code. Fans see the configured marketing language and one agreement button, followed by Spotify's own authorization screen. The successful callback writes profile, connection, scope grant and marketing acceptance atomically. Disabling or revising settings invalidates pending attempts.

`GET /api/sites/{id}/fans?offset=0&limit=50` returns `{fans,total,offset,limit}` to authorized workspace members even if billing expires. Fan attribution uses the site's owner and artist. These records are separate from email-only site signups and existing artist audience sources.

The return parameter `recoup_spotify=connected|cancelled|failed` is display-only, not proof of identity or an authenticated fan session. This release captures profile and available email with `user-read-email user-read-private`; it does not retain Spotify access/refresh tokens or implement ongoing listening-data collection, playback, marketing delivery or authenticated rewards. Expired authorization sessions are deleted on the next connection start.

## Engine skill and activity

The engine loads a deployment-pinned `recoup-content-build-sites` bundle. A metered read-only tool loop selects references; their IDs, source revision and adaptation guidance are retained in production context and supplied to concept, build and review. Both direct and durable paths permit up to three concrete implementation/asset repairs. Failed concept reviews remain needs-review, never silently published.

Apply `20260929010000_site_activity.sql` before deploying activity endpoints. Public activity accepts only visit/start/complete/replay/share events with UUID event and visit identifiers, is rate limited per site, and is idempotent by event ID. Customer activity reads are workspace-authorized and aggregate 30 days. These are browser-reported interactions, not verified Spotify listening or identified-person behavior.
