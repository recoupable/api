# CD-03: task-specific evidence, choices and recorded restrictions

Source-only contribution toward recoupable/app#2266, based on API main
`30c4d442c75137fa803802091dbb3991f4646e8b`. No model, route, settings, price,
provider account, migration, deployment or activation changes. This does not
complete CD-03 or certify production availability or commercial permission.

## Scope and behavior

`prepare.brief.model_choices` is an optional strict object with `image`,
`image_edit`, `motion`, `caption`, `still_inspection`, `video_inspection`, and
`analysis` string values. REST and MCP use the same schema. Omission retains the
configured routes. Estimate rejects an explicit choice that differs from the
configured route or does not apply to the plan, before source import or estimate
persistence. Exact applicable choices remain in the brief fingerprint. No silent
substitution or alternative provider routing is introduced.

Planning resolves production references from the selected creative context:

| Planned work | Provider tasks assessed |
| --- | --- |
| Artwork, quote card, carousel | Image or image edit, caption, still inspection |
| Video | Image or image edit, caption, motion, video inspection |
| Visualizer | Image or image edit, caption, video inspection |
| Missing valid completed audio context | Add analysis |
| Local composition | No provider task |

A targeted retry assesses only the selected asset. Its request accepts a job/asset
locator, not a replacement brief or model choices. Choices in the saved brief
continue to describe the original full pack: for a video-plus-artwork pack, an
artwork-only retry retains the original motion choice and full-brief fingerprint,
while its assets, budget and model assessment contain no motion work. A later
video retry still uses that exact saved motion choice. Preserving the choice is
not substitution or a promise to execute motion in every retry.

Full-brief choices are validated against the full pack before selecting the retry
asset. Revalidating inherited choices as if they were newly supplied for the
subset would reject a legitimate retry with no retry-input mechanism to correct
it. Removing the inherited choice would change saved intent/provenance. Unsupported
saved choices still fail; a newly specified motion choice for an artwork-only
full pack remains nonapplicable and fails. No retry-specific model selection is
introduced.

The same rule applies to a saved `model_choices.analysis`: after valid analysis
has completed, the original choice and brief fingerprint remain intact while the
new estimate omits analysis from its effective task assessment. Re-estimating does
not submit a new choice or repeat analysis. If new analysis is actually needed,
the relevant current restriction check still applies.

Completed valid audio context is reused. Accepted-receipt recovery and retained caption reuse are not new
provider effects. Production checks use the actual image/reference route or actual
inspection file type, not the entire configured pipeline.

## Assessment versus enforcement

Unknown capability, commercial basis, account access and lifecycle remain unknown.
The new report is explicitly an assessment, not authorization. It does not create
a blanket unknown-evidence gate or a runtime bypass flag. **Enabling a full
verified-evidence admission policy remains a product/access decision**, requiring
real task/provider/account evidence, a migration and recovery contract, and
independent review. Deprecation alone is not retirement and does not block a call.

Separately, a recorded commercial restriction or retirement on the exact current
model/endpoint refuses a genuinely new effect. A review expiry cannot erase a
recorded restriction. Changing an unrelated route's evidence cannot block the
current task. A mismatched binding is reported unknown rather than transferred to
a different model. No client assessment can authorize an effect or override the
server's restriction record.

The current source records Music Flamingo's published noncommercial restriction.
New analysis on that exact model/endpoint is therefore refused before source
signing/fetching, context writes or inference. New generation/failed-retry
approval that needs analysis is refused before credit checks/reservation/dispatch.
**Fresh packs currently require that analysis and remain blocked by this specific
restriction.** No replacement or commercial grant was invented to remove it.
Packs with retained completed analysis can continue their applicable existing
provider path; their unknown evidence is not newly treated as verified.

An already-funded running generate replay reaches the existing durable approve
idempotency branch without a new restriction admission check or credit check.
This exception is only the replay boundary: every genuinely new worker provider
effect still receives its own relevant restriction check. Failed-asset paid
retries are not exempt. Accepted receipts keep original route, request ID, input
fingerprint and charge; local composition and settlement do not require model
grants. Existing execution configuration checks remain in place.

## Quote compatibility and provenance

The existing route/settings/price `execution_config` and its digest are unchanged.
For the original configuration the digest remains
`012c31125aaae1e336fc23bfa69c7b22b9d6b0b4de9d9f93e7c00678caeb7a24`.
Legacy approved quotes lacking a model assessment remain supported under that
same integrity contract. Saved original quote fingerprints are not rewritten.
Genuine route/settings/price changes still follow the original requote rule.

New quotes add optional `model_readiness`: review version/date, applicable task
and model/endpoint bindings, source references, statuses, issues, and a canonical
assessment digest. Their new quote fingerprint also includes that assessment
digest. Thus new estimates record changed evidence without invalidating existing
funded quotes merely because evidence/version/expiry changed. The persisted
assessment is historical evidence, not an execution capability token. Current
restriction checks read only server-owned evidence.

Awaiting-approval readback exposes a separate current assessment and explains any
applicable recorded restriction. It preserves the stored quote assessment. Legacy
readback without a complete quote plan remains readable.

## Public evidence reviewed 2026-11-18

- [NVIDIA model card](https://huggingface.co/nvidia/music-flamingo-2601-hf)
  describes music audio understanding and identifies a noncommercial research
  restriction and NVIDIA OneWay Noncommercial License. No separate commercial
  grant or account availability was established.
- [OpenAI GPT-4o mini page](https://developers.openai.com/api/docs/models/gpt-4o-mini)
  lists text/image inputs and text/structured outputs and marks the model deprecated.
  Modality support does not prove application QA quality, Gateway availability or
  commercial authorization. [Deprecations](https://developers.openai.com/api/docs/deprecations)
  was also inspected; no retirement date is inferred from the older audit.
- Other routes are explicitly unverified in this review. Their exact source
  bindings are not claims of provider availability or licensing.

The 2026-12-18 review expiry is an internal review horizon, not a provider
retirement date. No account/config access was performed.

## Verification and remaining limits

Focused tests cover task variants, exact-choice and nonapplicable-choice refusal,
assessment provenance without execution-digest churn, new restricted analysis
before reservation, already-funded replay, and actual workflow preparation,
accepted polling, composition, inspection and settlement after unrelated evidence
changes. That recovery fixture uses real workflow/domain orchestration with
synthetic database/provider/media ports: it is not World execution, a real debit,
a provider call or production qualification.

Existing isolated first-use/analysis fixtures mock only restriction admission to
continue testing their original behavior. No fixture manufactures production
commercial/account evidence. Independent review and release remain with the
coordinator. Held foundation/database and SDK checkouts are not dependencies.
