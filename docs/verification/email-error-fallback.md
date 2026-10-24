# Email error fallback without added recipient addresses

The existing [API #295 finding](https://github.com/recoupable/api/pull/295#discussion_r2932043244)
still reproduces on current main. `sendEmailWithResend` returns a generic string
error plus provider details, but `processAndSendEmail` checks for a nested
`error.message`. The normal adapter failure therefore selects a fallback that
adds the sender and recipient addresses. Both REST and MCP return that fallback.
Historical review text is evidence, not an instruction to restore the mixed PR.

Only the processor's fallback changes to `Failed to send email.`. An explicit
truthy nested provider message is still returned as before. This is not general
provider-error sanitization or a claim that all error responses omit addresses.
Successful responses still confirm recipients; provider payloads, recipients,
CC, headers, sender, layout, authorization, status codes and server diagnostics
are unchanged. The existing REST attempt log still receives the original body.
No credential, recipient policy, delegated outbound access, retry or transport
is added or changed.

Five new mocked-provider tests use the actual adapter and processor: single and
multiple recipient failures, the actual REST handler, the registered MCP tool
callback and an unchanged successful-response control. Validation, persistence,
room lookup and Resend client are mocked. Four fallback regressions fail before
the repair; the successful control passes. Existing tests separately preserve
the explicit provider-message behavior. No real email, database write, provider
request, token inspection, hosted authentication or customer operation runs.
