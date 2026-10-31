# GitHub merge failure response parsing

An existing [API #294 review finding](https://github.com/recoupable/api/pull/294#discussion_r2931430659)
identified unguarded JSON parsing in merge failure handling. Current
`onMergeAction` delegates to `mergeGithubPR`, but that helper still parsed every
failed HTTP response as JSON. HTML, plain text, malformed JSON or JSON null could
throw; JSON without a usable string message could produce an invalid failure
result. This is a reproduced existing Mono #358/#318 finding, not an instruction
to restore the old mixed patch.

Only failed-response JSON parsing changes. A nonblank string `message` is
preserved exactly, including whitespace. Other bodies return
`{ ok: false, message: "GitHub merge failed (HTTP <status>)" }`. The existing raw
server diagnostic is retained; malformed/unusable bodies are not copied into
the returned message. This is not general sanitization of valid GitHub messages.

The URL, token forwarding, API version, PUT request, squash method, one-request
behavior and existing HTTP-success branch are unchanged. Network and body-read
failures still propagate unchanged; no retry, merge-result reconciliation,
permission change, approval-policy change or automatic merge is added. The
separate branch-merge helper is outside this repair.

Thirteen new tests use mocked fetch and synthetic responses: nine malformed or
unusable body cases, exact preservation of a usable JSON message, unchanged
network/body-read failures, and the actual registered action handler receiving
an HTML failure. The handler reports failure without changing PR state or
calling `handleMergeSuccess`; the mocked request still has the same endpoint,
headers and squash body. No real GitHub merge, comment, API mutation, database
operation or provider call was performed.

Before implementation ten new tests failed and three passed; all thirteen pass
afterward. The existing helper/action baseline passed nine tests across two
files. The broader coding-agent suite passes 114 tests across 26 files. Lint,
changed formatting and focused compilation of the production helper are
recorded separately; whole-project TypeScript cleanliness and live GitHub
delivery are not established.
