# Stored comments — Mono #327 / app #2023

This restores the existing documented `GET /api/comments` operation. It reads stored comments only. It does not scrape, enrich, write comments, bill, start workflows, or change the existing fan timestamp response. No customer rows or provider calls were used in local acceptance.

## Contract for API and documentation review

Authenticate with exactly one `x-api-key` or `Authorization: Bearer` credential through `validateAuthContext`. The caller identity always comes from authentication. `account_id` overrides are not accepted. Query parameters are `artist_account_id` (required UUID, legacy wire name for the target creator account), `post_id` (optional `posts.id` UUID, never a URL), `page` (positive integer, default 1) and `limit` (positive integer, default 10, capped at 100). Requests whose resulting offset exceeds the supported 32-bit range, unknown parameters and repeated parameters return 400.

Access reuses current direct roster, shared organization and Recoup administrator checks. A creator can read its own linked-post comments; an organization account key can read comments for creators linked to that organization. These read-only rules are scoped to this endpoint; existing artist mutation permissions are unchanged. The target ID never replaces the caller identity. Missing or denied targets both return 403 rather than revealing account existence. Authentication failures return 401. Lookup failures return a masked 500; there is no unscoped or provider fallback. Auth/access are checked anew for each request. Concurrent revocation inside an already executing request is not an atomic guarantee.

The query follows the authorized creator's `account_socials.social_id` values through `social_posts` and `posts` to `post_comments`. The comment author's `social_id` does not grant access to the post. An explicit post filter only narrows this set: an unrelated post returns an empty result. No linked socials returns an empty page without querying all comments. The existing social-link helper reads at most 10,000 links; this is not an exhaustive-history or ingestion-completeness claim.

Successful responses retain the existing flat shape: `status: "success"`, `comments` and `pagination: {total_count, page, limit, total_pages}`. Each comment exposes only `id`, `post_id`, `social_id`, `comment`, `commented_at`. Saved null values are preserved; the existing public Comment schema requires a companion nullability correction for nullable post/social/comment fields. No joined profile, grant, token or account metadata is exposed. Sort is `commented_at DESC, id DESC`; offset pagination is deterministic for a fixed dataset, not a frozen snapshot during concurrent inserts/deletes. Counts apply to the same ownership/post filter; missing exact-count metadata fails rather than inventing zero. GET responses are `Cache-Control: private, no-store`, including errors. CORS preflight reads nothing.

## Existing-work reconciliation

app #2023 is the original feature issue, not an implementation PR. API #480's closed/unmerged provider scrape is a different operation and is not reused. API #1057/#1058/#1061 already supply saved fan-comment recency, which does not supply comment bodies or restore this stored read. This change preserves those repairs. The operation's existing published UUID and five-field envelope resolve the original post-ID/shape questions without inventing a new API.

## Verification and release limits

Route tests execute the actual HTTP wrapper, current authentication mechanism selection and existing roster checks with synthetic storage/authentication leaves. Query tests enforce nested post ownership, post narrowing, empty-set denial, stable sort/range and saved nullable projections. An actual Supabase SDK builder runs against a stubbed HTTP boundary to verify URL/count/range serialization. These fixtures are not live PostgREST/database permission checks.

Independent review, normal CI, coordinator merge approval, documentation companion publication and an explicitly authorized scoped customer/weekly-report journey remain separate gates. Do not close all of #327 or app #2023 based on local tests, a source merge or the presence of a route alone.
