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
Whitespace-only and invisible-only words are rejected using `hasPackTextContent`.

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
