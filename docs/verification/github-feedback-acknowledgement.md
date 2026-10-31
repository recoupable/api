# Preserve accepted feedback dispatch when acknowledgement fails

After triggerUpdatePR resolves, a failure to post the confirmation comment must
not restore the prior pr_created state or report that the dispatch failed.
The webhook keeps updating and returns its existing update_triggered success;
a later sequential delivery receives the existing busy result. Failed HTTP
comment responses were already nonfatal. The same accepted-dispatch behavior
now applies when comment transport or reading its failed-response body rejects.
The original acknowledgement exception remains in a separate server diagnostic.

Dispatch failures retain the existing rollback and 500 response. Signature
verification, branch lookup, request payload, job selection, callback, comments,
credentials and shared-state model are unchanged. No new task, retry, delivery
receipt or remote-outcome assumption is introduced. Unknown dispatch outcomes,
concurrent-delivery races and recovery after a state-store failure remain outside
this repair. It is distinct from the prepared missing-token comment guard.

Four regression cases exercise the real webhook and comment helper with synthetic
signature/extraction, state, accepted-dispatch and fetch boundaries. They reproduce
two failures and two passing controls before the fix. All105 coding-agent cases
across26files pass afterward; focused types, changed-file ESLint/Prettier and diff
checks pass. No credentials, real task dispatch, GitHub comment, database/provider
request or customer action occurred. This is source/test proof, not hosted proof.
