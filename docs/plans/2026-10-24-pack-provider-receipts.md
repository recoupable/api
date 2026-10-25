# Preserve Release Pack provider receipt identity

Scope: the interrupted-request receipt portion of recoupable/app#2266 (CD-03),
under Release Packs recoupable/app#2254. This is not the complete model/budget phase.

Previously an accepted fal request stored its ID without its model route. Resume
polled the current default route, which could differ from the route that accepted
the request. The completion update also discarded the recorded charge.

The submission-intent receipt now records the selected model route, SHA-256 of the
serialized provider input, and charge credits before contacting fal. Acceptance
adds the request ID; completion adds the result while retaining these fields.
Resume polls the recorded route without another submission. The input hash records
the original settings; it is not proof of provider execution or an immutable
provider model version. Existing aliases remain aliases.

Legacy accepted receipts without a model remain intact and stop for reconciliation;
the current default is not evidence of their original route. Completed legacy
receipts still return saved outputs without a provider call. Submission intents
without an accepted ID still block automatic resubmission, including when the
provider accepted work but saving its ID failed. No migration/backfill or production
record edit is included. Any operational reconciliation needs original provider
evidence and separately authorized access/data changes.

Provider-free regression tests cover changed defaults, charge/input preservation,
legacy accepted/completed receipts, and persistence failures before and after
provider acceptance. Provider calls are mocked. No paid or live-host acceptance is
claimed. Model suitability, selection, pricing, quote-version binding, concepts and
full-budget accounting remain open in CD-03. No model or price changes here.
