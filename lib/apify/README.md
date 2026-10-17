# Verify social scrape billing

`scrapeProfileUrl` returns a discriminated internal attempt: `started` has a run ID
and no error; `failed` has an error and no run ID. Unsupported platforms return
`null`. The batch preserves the state through billing and persistence. Both HTTP
handlers select the existing public response fields explicitly; `state` stays
internal. A malformed provider result without a run ID is normalized to a failed
attempt; valid provider results retain their existing response and billing behavior.

A started profile costs `50,000 + 10,000 × requested posts` micro-dollar credits.
The artist batch checks available credits for all linked profiles first, then
makes one deduction for the started profiles before registering their runs. The
single-social route follows the same start-before-debit ordering. This does not
reserve credits or add idempotency. Full-report music analysis has a different
rule: each section must parse successfully before it is chargeable.

Run the local and CI regression tests with:

```sh
pnpm exec vitest run \
  lib/apify/__tests__/profileScrapeResult.test.ts \
  lib/apify/__tests__/scrapeProfileUrl.test.ts \
  lib/apify/__tests__/scrapeProfileUrlBatch.test.ts \
  lib/apify/__tests__/socialScrapeBillingRoutes.test.ts \
  lib/artist/__tests__/postArtistSocialsScrapeHandler.test.ts \
  lib/socials/__tests__/postSocialScrapeHandler.test.ts \
  lib/flamingo/__tests__/executeFullReport.test.ts
```

The type test compiles valid and invalid examples with strict null checks even
though the repository-wide TypeScript configuration currently disables them.
The route tests invoke the exported production `POST` functions with
`NextRequest` objects and run the real validation, dispatch, result mapping, and
deduction wrapper. Authentication, account access, stored rows, platform calls,
credit balance, debit persistence, and run persistence are fixtures. They make
no provider requests and no real charges. They do not start a Next.js HTTP server
or prove deployed authentication or account balances.

The user entry points are:

| Client and role | Action | Observable result |
| --- | --- | --- |
| HTTP client authenticated as an account with access to the artist | `POST /api/artist/socials/scrape` with `artist_account_id` and optional `posts` in JSON | Existing array of `{ runId, datasetId, error }`; one aggregate debit for only started profiles; only those runs registered |
| HTTP client authenticated as an account with access to the social's owning artist | `POST /api/socials/{id}/scrape?posts=20` | Existing `{ runId, datasetId }` on success; one debit and one registered run; failure has neither |

For release verification, repeat those actions only in an authorized test
environment with fixture provider and billing backends. Record the revision,
entry URL, intended account role, HTTP status/body, debit calls, and persisted
runs. A green fixture test is not evidence of a deployed request.

To check the gate itself, temporarily duplicate the artist handler's
`deductSocialScrapeCredits` call and run the handler and route tests. The exact
call-count assertions must fail, even though the debit arguments remain correct.
Restore the implementation and rerun the command. Widening the started state's
`error` to `string | null` must similarly fail the strict type test.
