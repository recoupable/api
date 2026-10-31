# Socials MCP failure response

The existing [API #295 finding](https://github.com/recoupable/api/pull/295#discussion_r2932043320)
still reproduces: the `update_artist_socials` callback returns caught
`Error.message` values. Full OAuth's outer generic catch does not replace this
already-returned tool response. Internal details can therefore appear in the
response through either registration path after the operation is reached.

Only the catch response changes to the existing non-Error fallback:
`Failed to update artist socials.`. The original exception is still logged with
the existing server diagnostic. Response envelopes, success payload, URL/platform
mapping, argument names, domain mutation and every access check are unchanged.
No new `isError` flag, throw/retry behavior or permission rule is introduced.

Eight mocked tests use the real registrar, full-OAuth wrapper and ownership
preparation with database/domain/rate-limit leaves mocked. Three Error-instance
cases reproduce the disclosure before the repair; five controls preserve the
non-Error fallback, success mapping, foreign-creator and revoked-grant denial,
and limited-OAuth exclusion. No live MCP call, database write, credential
inspection, provider action or change to effective access is performed.

This does not repair legacy target authorization. Legacy key/JWT transport
requires authentication but the raw handler forwards its caller-supplied
`artistId` without a target-creator access check. Full OAuth already performs an
accessible-creator check; limited OAuth does not expose this write tool. REST and
full OAuth have different existing access rules, including REST's admin bypass.
Choosing and enforcing the legacy rule requires separate authorization; this
message-only change must not be presented as closing that source gap or proving
hosted cross-account access. The audit packet records exact source paths and
decision prerequisites. Roster terminology does not rename the existing
single-creator `artistId` contract.
