# Development entitlement calculation (CATD-06 / CATD-29)

This is a **distinct, unregistered development adapter**. No HTTP action, MCP tool,
chat producer, database migration or production activation is added. Existing case
save/read operations continue to store customer assertions. Stream surfaces remain
stream observations. This is not production hosted parity acceptance.

## Method and contract

`calculateEntitlements(input)` is pure. `entitlementInputSchema` accepts the portable
schema version `"1"` and bounded rule, line and recoupment collections. Missing or
unsupported contractual terms retain the canonical manual-workpaper blockers;
malformed envelopes and non-string rule versions fail validation. `entitlementResultSchema` defines the returned
workpaper, including exact decimal strings, rule IDs/versions, evidence references,
bridges and unresolved cases. No division, FX conversion, new formula, commercial
threshold or financial decision is introduced.

The method `catalog-entitlements-v1` ports `calculate-entitlements.py` and `_finance.py`
from Skills commit `c3059ef3718abe1568fe3ae7c6e1e4c9d2589e48`. Pinned source copies in
`__tests__/oracle/` run only in tests; production does not require Python or a sandbox.
The oracle input is synthetic. Both source hashes are recorded in `oracle-manifest.json`.
Changes to the canonical method require parity review and an explicit method-version
decision, not an automatic update of saved results.

Amounts use exact decimal strings, or safe JSON integers. Decimal strings accept
ASCII base-ten digits, an optional sign/decimal point and exponent, and surrounding
whitespace. Unsafe JSON integers, binary fractions, nonfinite values and inputs
outside the canonical 24-digit/18-fractional-place bounds are rejected. The wire format deliberately excludes Python-specific underscore digit separators. Dates use
extended ISO `YYYY-MM-DD`. These explicit wire constraints avoid JavaScript number
precision loss and ambiguous non-JSON Python inputs. Internally scaled BigInt
arithmetic preserves all digits and decimal places. The supported fixed multiplications
and bounded sums fit within the canonical Python Decimal precision of 128.

## Proposed invocation

`runDevelopmentEntitlement(authenticatedAccountId, input, { rpc })` requires both
`NODE_ENV=development` and `CATALOG_ENTITLEMENT_DEV=true`. Production is always
rejected, even with the second flag set. It is not registered with any caller.
The account argument must come from authentication; input cannot contain an actor.
The existing `authorizeContextOwner` policy is the default, rechecked before the
read and before returning the result. Dependency injection is for internal tests,
following the existing Context processor convention.

Input is strictly:

```json
{
  "kind": "entitlement_calculation",
  "method_version": "catalog-entitlements-v1",
  "case_id": "22222222-2222-4222-8222-222222222222",
  "expected_revision": 1,
  "assessment_id": "entitlement-input-1"
}
```

Optional `organization_id` selects the existing authorized organization scope.
The adapter reads the **current** case and rejects a revision mismatch, incomplete
or redacted response. The selected reconcile/review-deal assessment must be current
and directly source-bound; derived `depends_on` inputs are explicitly unsupported
in this first slice. It reads:

- `assessment.data.entitlement_input`: the portable terms/lines/recoupment input.
- `assessment.data.entitlement_evidence_bindings`: a dictionary from every input
  `evidence_refs` identifier to `{source_id, version}`. Each binding used by the
  calculation must be in the assessment's source refs and resolve to a current,
  active, non-stale source. Source IDs and record IDs are case-scoped assertions,
  not provider identity or verified title.

The response includes `kind`, `method_version`, `provenance`, `result`,
`persisted: false` and `external_actions: "unsupported"`. Provenance identifies the
workspace/case/revision/assessment, canonical input hash (sorted object keys,
array order retained), pinned portable commit, and source versions/hashes.
`input_evidence_kind: customer_assertion` remains separate from
`result_kind: computed_from_supplied_terms`. Neither means authenticated contract
execution, recognized debt, rights verification or received money.

The only RPC is the existing scoped current case read. No result is saved, no
provider is called and no payment or action authorization is created. A future
public transport needs separate review of authentication, operation registration,
no-store/error behavior, retention, limits and exact schema. This proposal does not
silently broaden the existing read/save route or advertise a working customer tool.

## Validation

Run `pnpm exec vitest run lib/context/entitlements/__tests__` with Python 3 available
for the test oracle. The implementation itself is TypeScript-only. Tests compare
complete canonical outputs and cover disabled/production refusal, authority denial,
revocation, workspace/revision mismatches, stale/withdrawn/unbound sources, missing
inputs, numerical edge cases and manual-workpaper paths. These are synthetic and
mock-storage checks, not deployed authorization or private contract conformance.
