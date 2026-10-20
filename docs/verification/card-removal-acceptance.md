# Card-removal acceptance

Tracks [Mono #343](https://github.com/recoupable/mono/issues/343). This suite supplies independent, executable acceptance for the owning billing repair. It makes no production changes and does not contact Stripe, Supabase, Privy or Resend.

## Run

```sh
pnpm exec vitest run lib/billing/__tests__/cardRemovalAcceptance.test.ts
```

The suite keeps real API-key HMAC authentication, account parameter validation, removal/card/settings handlers, Stripe selectors, Supabase adapters and the automatic purchase orchestration. Only the external client boundaries use in-memory providers. API keys, account IDs, cards, subscription/invoice objects and email addresses are synthetic. Unexpected subscription/invoice access and global fetch calls fail the tests.

## Baseline reproduced

At API main `090f988060407e343d65dfdc3387156fb7dec0a5`, nine cases execute: six pass and three fail assertions:

| Case | Observed baseline behavior | Required repair |
| --- | --- | --- |
| Successful single-card removal | DELETE returns 204, settings still report enabled; the next low-balance attempt disables only after finding no card | Disable immediately; a subsequent automatic attempt skips |
| Two tagged customers with default cards | Only the selected card is detached; the next card read returns the older customer's card; the real orchestration reaches a simulated fallback charge | Disable immediately so remaining cards cannot automatically fund a top-up |
| Settings-write failure | DELETE returns 204 without attempting a settings write | Do not report complete success when the automatic-purchase disable cannot be persisted |

The positive control reaches a simulated successful automatic charge and receipt email before removal, demonstrating that the harness can observe an unwanted charge. The six passing baseline cases cover that control, no customer, no card, non-card default, Stripe detachment failure, and an unknown credential. Every case also rejects subscription/invoice operations and checks those synthetic records remain unchanged.

Across the related billing and credits suites, 239 cases run: 236 pass and only these three regressions fail. Changed-file TypeScript, scoped ESLint, formatting and diff whitespace checks pass on the test addition. These checks do not make the three baseline regressions pass.

## Scope and policy

The multiple-customer case characterizes the existing selected-card behavior: a different customer's card remains attached and visible to GET. It deliberately does not detach every account-associated card. The account-wide promise of `card: null` / checkout-only future manual purchases remains a separate contract decision; passing the immediate auto-top-up regression alone would not settle it. The failed-detachment case does not prescribe whether auto-top-up remains off after a partially failed request.

This is local synthetic acceptance, not Stripe test-mode or authenticated production proof. It does not establish distributed concurrency behavior, already-in-flight charge cancellation, subscription renewals or invoice settlement. No payment, card, subscription, invoice or customer operation was performed against a real provider.

## Candidate review

The production repair is [API #1054](https://github.com/recoupable/api/pull/1054), published head `bb7a492e5eec59ca54af033ea1f85e03e250edd1`, based on `c69768bda5b5f3e61483807f997c63a21f376040`. Its copied nine-case acceptance suite and provider fixture are byte-identical to the original test-only commit `820df9cf16d3ab73fe55d6a530168d28e8ea4490`.

Independent execution in a separate checkout of that exact candidate passes all 15 focused cases: the nine independent cases plus the six persistence/error-boundary cases added by the repair owner. Separate Standards and Spec source reviews found no actionable issue in the scoped repair.

This branch also strengthens the existing independent failure cases with public readbacks. If Stripe detachment fails, the card is still visible, settings report disabled and a subsequent automatic attempt skips without sending an email. If disabling cannot be saved, settings remain enabled, the selected card is still visible and no detachment occurred. Applying only these additional test assertions over the same production candidate again passes all 15 cases. This is a test-only overlay; the published candidate's production source was unchanged.

Scoped acceptance is **PASS**. The observed release checkpoint still has GitHub's `test` job in progress; lint, format, compatibility, Vercel and CodeRabbit pass, and Cubic is neutral. Exact-head checks and explicit release approval remain separate gates. No production billing operation or release was performed by this review.

API #1054 contains the actual repair and the adopted tests. Keep this test-only PR as the independent regression/review record; do not merge it separately into main or treat another PR's approval as approval for it. The account-wide card-removal contract decision remains outside this scoped acceptance.
