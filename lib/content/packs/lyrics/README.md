# Internal verified lyric timeline

`buildPackLyricTimeline` converts already verified words and timing into an
excerpt-relative, single-word render contract. It performs no I/O, transcription,
rendering, persistence, billing or activation. A `ready` result means this
structural transformation succeeded; it does not mean verification occurred or
that a lyric video exists. CD-06 / App2269 remains incomplete.

## Trusted caller boundary

Supply `expected` from existing authorized Pack state: job ID/revision, asset
ID/attempt, immutable recording storage key/SHA-256, probed recording duration,
and the approved excerpt. Supply the alignment's matching `target` separately.
Never derive `expected` from the alignment merely to make it match. Existing
`PackSources.audio` and `preparePackProduction` provide the snapshot/hash pattern;
this module does not read them or authenticate an account.

Alignment must have actually been checked against that exact recording, for both
words and timing. Its revision, evidence reference and verification reference
retain provenance. Their syntax is checked, but this parser cannot authenticate
those references or decide whether a reviewer truly verified the recording.
Placeholder references and unknown fields such as `verified: true` are rejected.
The trusted caller remains responsible for verification and authorized access.

The existing internal Scribe adapter returns provider timings, not verified
lyrics. Do not pass raw Scribe/model output as verified alignment, fabricate
missing words/timestamps, silently choose another recording, or invoke a provider
to fill a gap. No new provider adapter is introduced here.

## Exact timing and text

All source times are integer milliseconds from the beginning of the bound
recording. The verified range must contain the excerpt and every supplied word,
and lie within the probed recording duration. Words must have positive duration,
be in order and not overlap. Adjacent words are valid. Multiple simultaneous
voices need another reviewed contract; this one never sorts, deduplicates or
changes input timing to conceal overlap.

Intervals are half-open `[startMs, endMs)`. Words wholly outside the excerpt are
excluded; intersecting words are clipped and shifted by the exact excerpt start.
Each output cue retains its original `sourceStartMs` and `sourceEndMs`. A cue is
active only at `startMs <= t < endMs`; gaps display no word. Text is preserved
byte-for-byte as JavaScript Unicode text: no trimming, normalization, tokenizing,
punctuation insertion or language-dependent joining. One word is shown at a time.

The sole typography identifier, `portrait-word-v1`, is a proposed internal preset:
1080x1920 canvas, centered word in a 864x288 box starting at (108,816), 64px font,
white active text and black background. The eventual renderer must resolve an
installed, reviewed font with glyph coverage and enforce fit; font files, CSS,
filter expressions and arbitrary colors are not caller inputs. No font or
renderer is provided or certified by this module. Unsupported glyphs, text that
does not fit and native visual quality remain explicit renderer/QA gates; do not
silently substitute or truncate text.

Text is literal data, not HTML, ASS, shell or FFmpeg filter syntax. Quotes,
backslashes, braces, percent signs and angle brackets remain literal. A later
renderer must use a text-safe sink and test escaping in actual rendered frames;
these tests establish preservation only. Control characters, lone surrogates,
line/paragraph separators and bidi override/isolate controls are rejected.
Ordinary multilingual letters, combining marks and valid emoji joiners survive.
Whitespace-only and default-ignorable-only words are rejected using
`hasPackTextContent`; other combining marks remain literal Unicode. Their visible
appearance and glyph support require renderer QA.

## Bounds and outcomes

The recording ceiling is 1,200 seconds, matching the existing Pack preparation
limit. The following are experimental internal restrictions, not adopted product
policy or supported public limits: 60-second excerpt, 1,000 words, 128 Unicode code
points / 512 UTF-8 bytes per word, and 64 KiB of total word text (including words
outside the excerpt). Revision and evidence references are bounded to 512 UTF-16
code units. Exceeding a restriction is an error, never truncation.

- Missing/null alignment: `gap`, `missing_verified_alignment`.
- Valid verified range with no intersecting words (including verified silence):
  `gap`, `no_aligned_words`.
- Missing/malformed target or evidence, mismatched source/revision/excerpt,
  invalid timing/text or unsupported typography: validation error.
- Valid selected words: `ready` with target, provenance and plain-text cues.

Even a missing-alignment gap validates the independently supplied expected target.
Input objects are not mutated, and returned state is detached from caller inputs.

## Integration remains separate

No shared brief, composer, asset kind, runtime, route, factory, budget or pricing
changes accompany this contract. Before integration, revalidate expected state,
recording bytes, alignment revision and excerpt at the consuming boundary. Do not
reuse a saved composition under changed alignment or asset attempt. Reuse the
existing media/composition persistence, revision, inspection and budget ports.
Use original synthetic local media and injected leaves for renderer tests; actual
creative/native quality and App2266/2268 are separate gates. No public support,
provider accuracy, media synchronization or production readiness is claimed.

Tests use original synthetic words and fictional evidence references, not a
verified customer recording. Run the focused Vitest file under `__tests__`.

## Local injected renderer (not an active production recipe)

The optional `composePackMedia` lyric input now has a **separate, explicit local
capability argument**. Without it, the call fails before fetch/storage or the
paid default sandbox. Active `producePackAsset` callers do not populate lyrics;
no route, brief, asset kind, workflow, quote policy or stage-reuse behavior is
changed. Non-lyric composition retains its existing adapters.

The trusted capability supplies local fetch/store leaves and an owned runtime.
Composition enforces source/output byte checks and bounded runtime settlement.
Fetch leaves receive cancellation and a 50MiB read limit they must enforce while
reading; they run in a separate 180s scope before runtime allocation, with at most
5s cancellation settlement. An uncooperative fetch fails explicitly without
allocating a runtime. Storage runs only after successful runtime cleanup; its
implementation and completion remain trusted injected-leaf responsibilities. Its font bytes must match the reviewed
same-font TTF SHA-256 in `packLyricRenderTypes.ts`. The exact renderer build stdout
hash is checked, a known-font positive probe must succeed, and a missing-font
negative control must fail to demonstrate
that host font fallback is disabled. The existing WOFF2 cannot load in the tested
local binary; the same-font conversion and full official OFL notice remain in
ignored qualification evidence. No font binary, conversion dependency or external
runtime is packaged here. Pinned Linux/sandbox behavior is unqualified.

`buildPackLyricRenderPlan` validates independent expected state and alignment,
then hashes a versioned, fixed-order JSON array encoded as UTF-8. Its returned
payload includes the target, literal selected words, source/clipped/frame
intervals, provenance, typography, source/derived font hashes, conversion,
repertoire, frame policy and renderer identity. Changing a selected word under the same
alignment revision changes this key. It is a **lyric-plan** identity, not a
whole-composition, authenticated-verification or encoded-file identity. Visual
bytes are separately hashed in the receipt. Future activation must bind BOTH
saved composition and saved inspection to the full composition identity; the
current stage cache does not do that.

Only qualified basic Latin U+0020–U+007E is rendered; other glyphs fail explicitly.
Text is written literally to generated files and drawtext uses `expansion=none`.
No text enters filter syntax, filenames, shell commands, ASS or HTML. Each word
is measured on a finite 16384x256 scratch canvas; empty/edge-touching/oversized ink
fails. Measured ink is centered in the fixed 864x288 black plate, at 64px white
text, without resizing or truncation. Leading/trailing whitespace remains in the
input text; ink centering is based on visible glyph bounds. Transparent segments
represent gaps.

Both the main visual and overlay frame timelines start at zero. The main visual
is normalized to CFR30 **before** overlay evaluation. Word and gap segments have
integer frame counts and are encoded serially as lossless FFV1, verified by
counting decoded frames, concatenated, then reset to a frame-count timeline.
There is one overlay input, not one input for every cue. Cue intervals use ceil
bounds on the 30fps grid; a word occupying no sampled frame is refused. Still
visuals loop deliberately; short motion fails final frame-count validation.
Plate EOF does not hold a prior word. The video retains complete frames even
when an excerpt ends between frame boundaries; audio is trimmed independently
to the exact approved excerpt.

Compose start/duration must match integer milliseconds with only a 1e-6ms binary
representation allowance. FFmpeg seek/audio-trim values derive from the accepted
integers. Selected audio stream zero is explicitly mapped by its probed index;
its finite duration ticks/timebase are authoritative, not container duration.
Expected source duration rounds that rational to nearest ms, ties upward, while
exact containment still forbids source overrun. The new path currently refuses
missing or nonzero audio-origin metadata (including WAV probes lacking origin),
without guessing. The local fixture uses lossless ALAC with explicit timing.
Final probe checks finite audio/video metadata, geometry, frame count and CFR;
video timing must agree with its frame count. Encoded A/V tolerance is the larger
of one frame or one AAC frame at the sample rate, not the old generic 300ms
composition tolerance. Source precision and output codec padding are distinct.
The receipt retains selected stream index, codec, sample rate, channels, origin,
timebase, duration ticks and exact rational duration. Output explicitly requests
AAC at the selected source sample rate and channel count; final validation rejects
any change. Unsupported encoder rates fail rather than silently resampling.

Experimental bounds: 128 selected cues; one active command; one scratch raster
(4,194,304 pixels, at most 16MiB RGBA) and one decoded plate (995,328 RGBA bytes);
16MiB aggregate encoded plates; 256MiB aggregate intermediate segments; 50MiB
output; 1MiB command capture; 180 seconds for owned renderer work after the
separate source-fetch scope. Command leaves must enforce capture/cancellation before returning;
read sizes are checked before buffers are allocated. FFmpeg's individual
allocation cap is separately 64MiB because encoder packets exceed the scratch
pixel budget; it is NOT a whole-process RSS cap. Encoder buffers are additional.
Qualification records observed RSS and elapsed time without promising all
content will fit. Deadline/byte/failure paths abort owned commands, clean the
owned directory and reach storage only after cleanup succeeds. After the 180s
work limit, abort, callback settlement and cleanup each have a separate 5s
deadline, in that order. Abort failure, unknown closure or an unsettled callback
preserves owned files and refuses storage;
cleanup timeout reports unconfirmed cleanup, never success. No paid retries.

### Local qualification versus CI

Unit tests exercise schemas, exact plan identity, probe refusal and runtime guards.
Actual media cases require `PACK_LYRIC_TEST_FONT` pointing to the already-qualified
ignored TTF, plus local FFmpeg/FFprobe. Their `LOCAL QUALIFICATION` test names are
explicitly skipped when that prerequisite is absent: a green ordinary CI run does
not claim renderer qualification. The source acceptance packet must retain an
actual prerequisite-enabled run. `PACK_LYRIC_OUTPUT_DIR` optionally retains the
original synthetic outputs and command/probe evidence; `PACK_LYRIC_MEASURE_RSS=1`
uses the installed macOS time utility for observed child RSS. The local leaf owns
a detached process group, including the measurement wrapper and FFmpeg child;
abort sends TERM, escalates to KILL after 250ms, and requires pipe closure within
2s. Unknown closure retains the owned directory and reports its path/process
group; cleanup/disposal refuse while children or termination uncertainty remain. A real measured-mode
cancellation test verifies that an active unbounded command settles after abort
and that its process group no longer appears in the OS process inventory.
The leaf restricts media protocols to file/pipe, rejects overrides, and validates
owned input/output and filesystem names. Fixed trusted filters remain required;
this is not an OS sandbox or a general safe executor for arbitrary FFmpeg filters.
These are test-only local controls, never API inputs.

Fixtures check 24fps, 60fps and VFR visuals with nonzero PTS; exact highlight/gap
frames; selected nonzero audio excerpts against a contrasting motion soundtrack;
full-excerpt decoded PCM against an independently selected original segment
(normalized RMS error below 20% for lossy AAC, including excerpt edges), with a
13ms shifted negative control required to exceed that tolerance;
128-cue serial resource behavior; short visuals, overflow, wrong source hashes
and malformed probes with no stored output. Separate deadline tests use controlled
clocks, not a real three-minute delay. Native customer creative quality, non-Latin
rendering, live recipe selection, font packaging, authenticated verification and
App2269 completion remain separate.
