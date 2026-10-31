# CD03 route compatibility and commercial readiness

Read-only review dated October 30, 2026 (America/New_York), against API main
`9e4251777848af53998e4f3243bc8189d804744d`. Public documentation was retrieved that
day; search-index ages are distinguished below. No account, credential, provider
execution, purchase or production data was accessed. This is a technical evaluation
of published terms, not evidence of a separate commercial grant or account contract.

## Existing routes

| Stage and exact identity | Capability and current adapter fit | Commercial-use evidence | Published provider pricing and uncertainty | Recommendation |
| --- | --- | --- | --- | --- |
| Audio: `nvidia/music-flamingo-2601-hf`, self-hosted Modal `/generate` | Audio + text to text; 20-minute cap matches the local decoder limit. Adapter expects response text and inference time, then validates JSON observations/direction/timing. [NVIDIA card](https://huggingface.co/nvidia/music-flamingo-2601-hf). | Card explicitly restricts this checkpoint to noncommercial research and links the NVIDIA OneWay Noncommercial License. No separate grant established. | Source deploys A100 40GB with a 60-second scaledown window. [Modal](https://modal.com/pricing) lists $0.000583/GPU-second plus CPU, memory and other applicable resources. Audio duration is not GPU billable duration; no per-song measured cost established. | Do not extend commercial concept work on this checkpoint without a grant. Prepare the commercial replacement below; retain uncertain-attempt reconciliation. |
| Still generation: `meta/muse-image/text-to-image` | Text to image; current prompt, num_images=1, PNG and 9:16 fields are in the [API schema](https://fal.ai/models/meta/muse-image/text-to-image/api). Ratio controls shape, not arbitrary pixel resolution. | [fal model page](https://fal.ai/models/meta/muse-image/text-to-image) labels commercial use. | Same official page's search-index snapshot (three weeks old) lists $0.01/output image. Current rendered extraction did not expose its price widget, so revalidate the exact route price before funding concepts. | Retain the existing house route. No quality or rights clearance for supplied materials is inferred. |
| Reference stills: `meta/muse-image/edit` | Multiple reference images and text; image_urls plus the same output fields fit the [edit schema](https://fal.ai/models/meta/muse-image/edit/api). Production/reference-only selection stays upstream. | Official edit page labels commercial use. | [Official indexed page](https://fal.ai/models/meta/muse-image/edit) lists $0.01/output image, crawled last month. Fresh route-price readback remains required; do not substitute Meta direct-API pricing as fal proof. | Retain; same freshness caveat as generation. |
| Motion: `minimax/h3-max/image-to-video` | [Schema](https://fal.ai/models/minimax/h3-max/image-to-video/api) accepts existing first-image, duration, 768P, balanced expansion and safety settings. Output may exceed requested duration by about 0.7 seconds; local composition trims to approved music excerpt. | fal's [H3 Max page](https://fal.ai/minimax-h3-max) explicitly permits commercial projects through its API. | Current fal page lists $0.08/output-second at 768p ($0.05 at480p, $0.16 at1080p). It states the 75% launch discount ended September14. This supersedes relying on older October31 promotion notes; exact endpoint billing still needs readback before concept budgeting. | Retain 768P route and current house charges. Do not silently switch to Turbo. |
| Caption and still QA: Gateway `openai/gpt-4o-mini` | Text and image inputs, text/structured output supported by [OpenAI](https://developers.openai.com/api/docs/models/gpt-4o-mini). Captions use plain text; image QA parses a strict local JSON judgment, not a provider schema guarantee. | [OpenAI Services Agreement](https://openai.com/policies/services-agreement/) supports customer applications and assigns output rights subject to terms/input rights; Gateway/provider terms also apply. | OpenAI standard token rates: $0.15/M input, $0.075/M cached input, $0.60/M output. Image token usage is additional input, not a flat per-image charge. [Deprecation notice](https://developers.openai.com/api/docs/deprecations): July2024 snapshot shuts down January14,2027; alias resolution through Gateway is not a pinned snapshot. | Prepare Pack-only migration to `openai/gpt-6-luna`, not another retiring4.1 route. No switch in this patch. |
| Video QA: `pegasus1.5` via TwelveLabs `v1.3/analyze` | [1.5 documentation](https://docs.twelvelabs.io/v1.3/docs/concepts/models/pegasus/pegasus-1-5) supports video-to-text and structured responses; 9:16, short MP4 clips and direct signed URLs fit documented input constraints. Current adapter reads data/finish_reason/usage. | [Terms of Use](https://www.twelvelabs.io/legal/terms-of-use), updated August25, govern API/output use; separate enterprise contracts may override them. They permit training/improvement unless opted out. Applicable contract and opt-out are unverified, particularly relevant to private media. | [Published Pro overage](https://www.twelvelabs.io/overage): $1.75/input video hour + $7.50/M output tokens. This is not every account's plan or invoice; includes neither all storage nor subscription allocation. | Retain1.5; [1.6](https://docs.twelvelabs.io/docs/concepts/models/pegasus) exists, but existence alone does not justify an adapter change. Isolate account terms/plan verification to this row. |

## Recommended replacement candidates

**Audio default to evaluate: `google/gemini-3.8-flash`.** Google's
[stable model specification](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)
supports audio input, text and structured output; low/medium/high thinking, not
minimal. The [audio guide](https://ai.google.dev/gemini-api/docs/audio) covers
non-speech/music understanding and timestamped segments. This is better matched
to audible observations than a speech-only transcription substitute, but its music
quality and timestamp accuracy remain untested. Gateway [lists the route](https://vercel.com/ai-gateway/models/gemini-3.8-flash);
catalog presence does not establish team access or the selected upstream provider.

[Google standard pricing](https://ai.google.dev/gemini-api/docs/pricing) is
$0.75/M input and $3.75/M output through December31,2026, then $1.50/$7.50 from
January1,2027; output includes thinking. At the documented32 audio tokens/second,
20minutes represents38,400 audio tokens: $0.0288 promotional input or $0.0576 at
announced January rates, before prompt/output/thinking. These are illustrative
provider inputs, not customer charges or a complete budget. Use the announced
nonpromotional rates for budget design, with bounded reasoning/output and measured
usage reconciliation. No grounding tools are needed for listening to the recording.

For private audio, use paid-service data terms: [Google's terms](https://ai.google.dev/gemini-api/terms)
state paid API requires an active billing project and excludes prompts/responses
from product improvement, unlike ordinary unpaid usage. Gateway's selected
provider contract must be checked separately; do not assume free Gateway credits
establish those Google paid-service conditions. A new adapter must send authorized
bytes/file parts, retain hashing/ownership checks, accept only the existing validated
analysis shape, and keep the uncertain-state guard. Do not replace the existing
Modal URL with a Gemini URL while preserving the incompatible request envelope.

**Caption/still-QA default to evaluate: `openai/gpt-6-luna`.** OpenAI recommends it
in the retirement notice. Its [model specification](https://developers.openai.com/api/docs/models/gpt-6-luna)
supports text/image input and structured output. [Gateway's official route](https://vercel.com/ai-gateway/models/gpt-6-luna)
lists $0.10/M input and $0.50/M output and demonstrates image-message input.
Reasoning can consume output budget: explicitly evaluate no-reasoning mode with
the installed AI SDK6 adapter before reusing350/600-token caps. Keep maxRetries=0,
actual image inspection and strict local judgment validation. No quality equivalence
or installed-account access is established by these public docs.

## Source slice and remaining prerequisite

This patch separates `PACK_CAPTION_MODEL` and `PACK_STILL_INSPECTION_MODEL` from
the application-wide `LIGHTWEIGHT_MODEL`, retaining `openai/gpt-4o-mini` for both.
Quotation and execution share those Pack constants. Existing configuration
snapshot/digest binding is already adopted and is reused, not rebuilt. No serialized
configuration, adapter version, price, prompt, route or behavior changes now.
Tests simulate an unrelated global model change and verify Pack quotation,
caption execution and actual-image QA remain on their recorded routes without retries.

The next local implementation is the dedicated audio adapter and mocked
Gemini request/response compatibility, plus explicit Luna reasoning/output handling.
Before activation, verify selected provider account access/data terms, qualify a
bounded authorized recording/image fixture, and fund all analysis/QA/concept/refinement
components inside the approved ceiling. Muse price-widget freshness and TwelveLabs
account terms remain isolated verification items. No need to reconsider the retained
image/motion models or recreate quote binding to advance those adapters. Existing
house rates are not measured provider expenses; keep the separate held accounting PR.
