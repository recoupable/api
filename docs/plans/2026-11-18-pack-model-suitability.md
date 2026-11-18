# CD-03: model evidence at the existing pack approval boundary

Source-only contribution toward recoupable/app#2266, based on API main
`30c4d442c75137fa803802091dbb3991f4646e8b`. No model, route, settings, price,
provider account, deployment, or activation changes. This is not completion of
CD-03 or permission to run production.

## Behavior

`prepare.brief.model_choices` is an optional strict object with `image`,
`image_edit`, `motion`, `caption`, `still_inspection`, `video_inspection`, and
`analysis` string values. The same schema serves REST and MCP. Omission keeps the
configured routes. At estimate time, any explicit choice differing from its
configured route is rejected by name, with no substitution. An exact choice is
retained in the brief and its fingerprint; it does not establish suitability.
No additional route or arbitrary provider choice is enabled.

Quotes snapshot `execution_config.model_evidence` with its review version,
review date, exact task/model bindings, analysis endpoint, evidence references,
capability, lifecycle, commercial basis, account availability and review expiry.
The existing configuration digest and quote fingerprint bind this evidence.
Changing evidence requires a new estimate and approval. Existing route/settings/
price identity is unchanged, but older quotes lacking evidence cannot authorize
new work. Explanatory cost-accounting compatibility is unchanged.

`assertPackNewWork` first enforces the existing exact configuration check, then
requires verified capability, commercial basis and account availability,
supported lifecycle, matching route/endpoint, nonempty sources and unexpired
evidence. It runs before new approval/reservation and each unstarted production
stage. This initial policy conservatively checks the whole configured pack
pipeline, including routes a particular asset may not use. It does not yet
select different models per deliverable or perform quality evaluations.

The current evidence intentionally blocks all new pack execution. Quotes remain
available for inspection; awaiting-approval readback explains the blockers rather
than asking the customer to approve an unusable quote. Public listings are not
account access or commercial grants. Reviewing a model, listing it, or supplying
an explicit preference cannot override these checks.

Accepted-request resume remains outside the new-work gate. Saved original route,
request ID and charge recovery are unchanged. After receipt recovery, the next
unstarted stage must pass the new gate. Missing/unsupported legacy receipts
retain the existing refusal behavior. No automatic retry or paid substitution
is introduced.

## Public evidence reviewed 2026-11-18

- [NVIDIA Music Flamingo model card](https://huggingface.co/nvidia/music-flamingo-2601-hf)
  describes music audio understanding and identifies a noncommercial research
  restriction and NVIDIA OneWay Noncommercial License. This supplies task-modality
  evidence, not a separate commercial grant. Account availability remains unknown.
- [OpenAI GPT-4o mini model page](https://developers.openai.com/api/docs/models/gpt-4o-mini)
  lists text/image input and text/structured output and marks the model deprecated.
  Caption and still-inspection modality support does not prove current Gateway
  account availability, application QA quality, or commercial authorization.
- [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations)
  was inspected; this contribution does not carry forward a retirement date from
  an older audit. Deprecated and retired are distinct; this new-work policy requires
  a supported lifecycle and therefore refuses either.
- Remaining configured image, editing, motion and video-analysis routes are
  explicitly unverified in this review. Their route bindings come from existing
  source, not a new claim about provider availability or licensing.

The initial review horizon is 2026-12-18, a conservative internal expiry rather
than a provider retirement date. No account/configuration access was performed.
Future enabling evidence requires a reviewed server source change with appropriate
nonsecret references; there is no client-supplied evidence or activation switch.

## Verification and delivery

Tests cover mismatched explicit choices, schema refusal, evidence version changes,
unknown/restricted/retired/expired evidence, route/endpoint mismatch, new-effect
refusal, refusal before credit checks/reservation/dispatch, and legacy accepted
receipt recovery. Positive production-path fixtures explicitly use synthetic
verified evidence; they do not certify the real models or accounts.

Independent review and merge/release remain with the coordinator. Held foundation
and database changes are not dependencies and are not modified by this branch.
