# Local concurrent refresh acceptance

`scripts/mcp-oauth/__tests__/provider.test.ts` composes the installed local
`oidc-provider` library, the existing loopback OAuth/MCP fixture, and the encrypted
adapter backed by the disposable PostgreSQL cluster from `testPostgres.sh`.
All identities, tokens and keys are synthetic. Provider metadata comes from an
in-memory map; the test file rejects non-loopback fetches and disables automatic
redirect following. It never calls a hosted OAuth provider or production database.

The PostgreSQL-only race case holds two redemptions of the same refresh token at
the adapter's consumption boundary, then releases both. It asserts exactly one
200 response and one `invalid_grant`, without credentials in the losing response.
The successful successor can access the fixture and rotate again. A subsequent
sequential replay sees the consumed marker and triggers the library's existing
grant-revocation behavior: that successor loses access and cannot refresh. A
separate synthetic grant remains usable throughout. The barrier does not replace
or serialize the database's atomic consumption decision, and times out if both
requests do not reach it.

Use the existing `scripts/mcp-oauth/testPostgres.sh` with the owning database's
OAuth store, connected-apps, grant-binding and persistent-connection migrations.
Without its isolated `OAUTH_TEST_PG_SOCKET`, the race case is explicitly skipped;
an in-memory-only run does not prove concurrent PostgreSQL redemption.

October 25, 2026: the controlled concurrent-redemption case passes on disposable
PostgreSQL 17.7. No runtime fix was needed. This advances Mono #209/#214's race
acceptance under #207; it is not production refresh, named-client, actual Privy
consent, current deployed configuration, or a complete OAuth launch receipt.
