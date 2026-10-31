# Missing GitHub comment token

Before this guard, the [API #295 review finding](https://github.com/recoupable/api/pull/295#discussion_r2932043222)
reproduced on main: `postGitHubComment` attempted a request with
`Authorization: token undefined` or an empty token when `GITHUB_TOKEN` is absent
or empty. Historical review text is evidence to reproduce, not authority to
restore the unrelated mixed patch.

The helper now logs a static configuration error and returns before fetching in
those two cases. Its existing `Promise<void>` contract and configured-token
request URL, headers, body, success behavior and HTTP-failure logging remain
unchanged. Configured-token network/body-read errors still propagate; no retry
or delivery guarantee is added. Whitespace-only or invalid configured values are
not newly normalized or validated.

The sole located caller, `handleGitHubWebhook`, queues the PR update before
posting its acknowledgement. [API #1119](https://github.com/recoupable/api/pull/1119)
already separates acknowledgement errors from dispatch failures, keeping an
accepted update in its `updating` state even if the comment fails. This guard
additionally avoids an unnecessary comment request when its token is missing.
It does not protect the caller's separate PR-detail fetch, enable GitHub
credentials or change webhook authority. The no-request integration tests supply
the branch directly, so they do not exercise that separate lookup.

Five new tests use mocked fetch, signature validation, state persistence and job
dispatch. Four missing/empty-token cases fail before the repair; the existing
configured-token network-error behavior passes as a control. The integration
cases use the actual helper and webhook handler with a supplied branch, verify
one dispatch, one `updating` write, no restoration, a successful webhook response
and no GitHub request. Existing tests cover configured request fields and
HTTP-failure diagnostics. No actual GitHub comment, job, customer, provider,
database or credential operation runs during verification.
