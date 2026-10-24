# Branch-merge failed-response handling

`mergeGithubBranch` returns its existing `{ ok: false, message }` result when a
failed GitHub HTTP response contains HTML, plain text, malformed JSON, an empty
body or JSON without a nonblank string message. The fallback includes the HTTP
status; a nonblank GitHub JSON message remains unchanged. Server diagnostics
retain the existing status/body log.

The request endpoint, method, headers, branch payload and successful responses
are unchanged. Network and body-read failures still reject; no retries or remote
outcome assumptions were added. Existing action authorization, branch selection
and release workflow are outside this repair. Tests invoke the real helper and
action handler with mocked fetch and thread posts; no real merge or post occurs.

Verification: 13 new mocked cases reproduced 10 failures and 3 passing controls
before the fix; all 114 coding-agent cases across 26 files pass afterward.
