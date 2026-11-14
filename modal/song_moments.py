"""
song_moments.py
---------------
Measures a song's sections and its best short moments from the audio itself.

No language model is involved. Times come from the beat grid, the loudness
curve and which passages sound alike. An optional section order from a lyric
sheet (for example ["verse", "chorus", "verse", "chorus", "bridge", "chorus"])
names the sections; without one, names are inferred from repetition and
loudness and the result says so (`names_from: "audio"`).

Pure analysis code with no Modal imports, so it runs the same locally
(`measure_file` adds the extended fields from song_measure.py):
  uv run --no-project --with librosa==0.10.2.post1 --with pyloudnorm==0.1.1 \
    python -I modal/song_moments.py <audio file> [--tempo-hint BPM] [section labels...]

`serve_song_moments.py` wraps it as the Modal web endpoint behind
POST /api/songs/moments.
"""

import numpy as np

# ---------------------------------------------------------------------------
# Configuration — all tunables live here (no magic numbers inline)
# ---------------------------------------------------------------------------
MEASURE_VERSION = "song-moments-2026-11-04"  # bump when results would change; stored with each song
SAMPLE_RATE = 22050
HOP_LENGTH = 512
CUT_SECONDS = (6, 15, 30)          # standard ad and promo lengths
SMOOTH_BEATS = 4                    # average features over a bar of 4 beats
NOVELTY_KERNEL_BEATS = 16           # checkerboard kernel width for boundary strength
NOVELTY_WEIGHT = 2.0                # bonus for starting a section where the sound changes
PROTOTYPE_WEIGHT = 0.7              # pull sections toward others with the same name
OPTIONAL_SECTION_PENALTY = 3.0      # an unlisted intro/outro must earn its place
ALIGN_PASSES = 4                    # refinement passes once section prototypes exist
REPEAT_SIMILARITY = 0.6             # cosine at or above this = the same section repeating
OPENING_BEATS = 16                  # also compare how sections start: repeats often end differently
# Per beat, how much a section name prefers loud (+) or quiet (-) audio, in
# standard deviations of the song's own loudness. Choruses usually lift.
LOUDNESS_PREFERENCE = {"chorus": 0.4, "drop": 0.4, "intro": -0.2, "outro": -0.2}
AUDIO_ONLY_SECTION_SECONDS = 12     # first-pass section length; same-named neighbors merge later
MOMENT_MAX_SECONDS = 20
HOOK_SECONDS = 15
CLIMAX_SECONDS = 15
BUILD_LEAD_SECONDS = 14             # how much of the rise to include before the payoff
BUILD_PAYOFF_SECONDS = 4            # and how much of the payoff after it
BUILD_MIN_RISE_DB = 3.0
BUILD_BEFORE_SECONDS = (12, 8)     # the quieter stretch the rise is measured from
BREAKDOWN_DROP_DB = 4.0             # below the song's median loudness
BREAKDOWN_MIN_SECONDS = 6
FADE_WINDOW_SECONDS = 6
FADE_DROP_DB = 10.0
OVERLAP_MERGE = 0.6                 # moments sharing this much of the shorter one merge

# Section names we return, and the lyric-sheet headers that map to them.
LABEL_ALIASES = {
    "intro": "intro",
    "verse": "verse",
    "pre-chorus": "pre-chorus",
    "prechorus": "pre-chorus",
    "pre chorus": "pre-chorus",
    "chorus": "chorus",
    "hook": "chorus",
    "refrain": "chorus",
    "post-chorus": "post-chorus",
    "postchorus": "post-chorus",
    "post chorus": "post-chorus",
    "bridge": "bridge",
    "middle 8": "bridge",
    "instrumental": "instrumental",
    "instrumental break": "instrumental",
    "instrumental bridge": "instrumental",
    "interlude": "instrumental",
    "solo": "instrumental",
    "break": "instrumental",
    "drop": "drop",
    "breakdown": "breakdown",
    "outro": "outro",
}

# (shortest, longest) plausible length in seconds for each section name.
SECTION_SECONDS = {
    "intro": (2, 40),
    "verse": (8, 75),
    "pre-chorus": (4, 35),
    "chorus": (8, 75),
    "post-chorus": (4, 35),
    "bridge": (6, 60),
    "instrumental": (4, 60),
    "drop": (8, 75),
    "breakdown": (4, 45),
    "outro": (3, 80),
    "section": (6, 75),
}

# When two moments overlap, the one listed first keeps its slot.
MOMENT_PRIORITY = ["vocal_hook", "climax", "build_up", "chorus_lift", "breakdown", "intro", "outro"]


def normalize_label(raw):
    """Map a lyric-sheet header such as "Verse 2" or "Post-Chorus: Anne" to a section name, or None."""
    text = str(raw).lower().split(":")[0].split("(")[0].strip()
    text = text.rstrip("0123456789 ").strip()
    if text in LABEL_ALIASES:
        return LABEL_ALIASES[text]
    for alias, name in LABEL_ALIASES.items():
        if text.startswith(alias):
            return name
    return None


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------
def _fill_gaps(beats, n_frames):
    """
    Make the beat grid cover the whole song. The tracker can lose the beat in
    a breakdown or a fade; any gap longer than 1.5 beats gets evenly spaced
    beats, and the grid is extended to both ends at the median beat length.
    """
    if len(beats) < 2:
        period = max(1, int(round(0.5 * SAMPLE_RATE / HOP_LENGTH)))  # assume 120 bpm
        return np.arange(0, n_frames, period)
    period = float(np.median(np.diff(beats)))
    filled = list(np.arange(beats[0] - period, period / 2, -period)[::-1])
    for a, b in zip(beats[:-1], beats[1:]):
        filled.append(a)
        steps = int(round((b - a) / period))
        if (b - a) > 1.5 * period and steps > 1:
            filled.extend(a + (b - a) * k / steps for k in range(1, steps))
    filled.extend(np.arange(beats[-1], n_frames - period / 2, period))
    filled = [f for f in filled if f >= period / 2]  # the grid always starts at 0 (fix_frames)
    return np.unique(np.round(filled).astype(int))


def _beat_grid(y, sr):
    """Beat-aligned intervals: interval i runs from times[i] to times[i + 1]."""
    import librosa

    n_frames = 1 + len(y) // HOP_LENGTH
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=HOP_LENGTH, units="frames", trim=False)
    bounds = librosa.util.fix_frames(_fill_gaps(beats, n_frames), x_min=0, x_max=n_frames)
    times = librosa.frames_to_time(bounds, sr=sr, hop_length=HOP_LENGTH)
    times[-1] = len(y) / sr
    return float(np.atleast_1d(tempo)[0]), bounds, times


def _zscore(rows):
    mean = rows.mean(axis=1, keepdims=True)
    std = rows.std(axis=1, keepdims=True) + 1e-9
    return (rows - mean) / std


def _beat_features(y, sr, bounds):
    """Unit vectors per beat mixing harmony, timbre and loudness, smoothed over a bar."""
    import librosa

    chroma = librosa.util.sync(
        librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=HOP_LENGTH), bounds, aggregate=np.median, pad=False
    )
    mfcc = librosa.util.sync(librosa.feature.mfcc(y=y, sr=sr, hop_length=HOP_LENGTH, n_mfcc=13), bounds, pad=False)
    rms = librosa.util.sync(librosa.feature.rms(y=y, hop_length=HOP_LENGTH), bounds, pad=False)
    rms_db = 20 * np.log10(rms + 1e-9)

    blocks = [
        _zscore(chroma) / np.sqrt(chroma.shape[0]),
        _zscore(mfcc[1:]) / np.sqrt(mfcc.shape[0] - 1),
        _zscore(rms_db) * 0.7,
    ]
    feats = np.vstack(blocks)
    kernel = np.ones(SMOOTH_BEATS) / SMOOTH_BEATS
    feats = np.vstack([np.convolve(row, kernel, mode="same") for row in feats])
    units = feats / (np.linalg.norm(feats, axis=0, keepdims=True) + 1e-9)
    return units.T, rms_db[0]


def _novelty(units):
    """How sharply the sound changes at the start of each beat, 0..1 (Foote checkerboard)."""
    n = len(units)
    ssm = units @ units.T
    half = NOVELTY_KERNEL_BEATS // 2
    sign = np.concatenate([-np.ones(half), np.ones(half)])
    kernel = np.outer(sign, sign) * np.outer(np.hanning(2 * half), np.hanning(2 * half))
    padded = np.pad(ssm, half, mode="edge")
    score = np.array([np.sum(padded[i:i + 2 * half, i:i + 2 * half] * kernel) for i in range(n)])
    score = np.maximum(score, 0)
    novelty = np.append(score / (score.max() + 1e-9), 1.0)  # the song's end is a boundary
    novelty[0] = 1.0
    return novelty


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------
def _align(tokens, optional, prefix, loud, times, novelty, prototypes):
    """
    Best split of the beats into consecutive sections named `tokens` in order.

    A section scores for sounding consistent inside (length of its summed unit
    vectors), for resembling other sections with the same name (prototypes),
    for starting where the sound changes (novelty), and for being as loud or
    quiet as its name suggests (`loud` is the prefix sum of per-beat loudness
    in standard deviations). Optional tokens may be
    skipped. Returns ([(start_beat, end_beat, name)], score), or (None, None)
    when the lengths cannot fit the song.
    """
    n = len(prefix) - 1
    n_tokens = len(tokens)
    neg = -1e18
    best = np.full((n_tokens + 1, n + 1), neg)
    start = np.full((n_tokens + 1, n + 1), -2, dtype=int)  # -1 marks a skipped token
    best[0, 0] = 0.0

    for j, name in enumerate(tokens, start=1):
        shortest, longest = SECTION_SECONDS[name]
        proto = prototypes.get(name)
        weight = PROTOTYPE_WEIGHT if proto is not None else 0.0
        penalty = OPTIONAL_SECTION_PENALTY if optional[j - 1] else 0.0
        lean = LOUDNESS_PREFERENCE.get(name, 0.0)
        for t in range(1, n + 1):
            lo = np.searchsorted(times, times[t] - longest, side="left")
            hi = np.searchsorted(times, times[t] - shortest, side="right") - 1
            if hi < lo:
                continue
            s = np.arange(lo, hi + 1)
            previous = best[j - 1, s]
            ok = previous > neg / 2
            if not ok.any():
                continue
            summed = prefix[t] - prefix[s]
            score = (1 - weight) * np.linalg.norm(summed, axis=1) + NOVELTY_WEIGHT * novelty[s] - penalty
            if lean:
                score = score + lean * (loud[t] - loud[s])
            if proto is not None:
                score = score + weight * (summed @ proto)
            total = np.where(ok, previous + score, neg)
            k = int(np.argmax(total))
            best[j, t] = total[k]
            start[j, t] = s[k]
        if optional[j - 1]:
            skip = best[j - 1] > best[j]
            best[j, skip] = best[j - 1, skip]
            start[j, skip] = -1

    if best[n_tokens, n] <= neg / 2:
        return None, None
    sections, t = [], n
    for j in range(n_tokens, 0, -1):
        s = start[j, t]
        if s == -1:
            continue
        sections.append((int(s), int(t), tokens[j - 1]))
        t = s
    return list(reversed(sections)), float(best[n_tokens, n])


def _prototypes(sections, units):
    protos = {}
    for name in {name for _, _, name in sections}:
        rows = np.vstack([units[s:e] for s, e, n in sections if n == name])
        mean = rows.mean(axis=0)
        protos[name] = mean / (np.linalg.norm(mean) + 1e-9)
    return protos


def _split_by_lyrics(order, units, prefix, loud, times, novelty, seeds):
    """
    Fit the lyric sheet's section order to the audio, refining as names settle.

    Each seed is a starting guess at what a named section sounds like (for
    example, a block the audio repeats, tried as the chorus). The fit that
    scores best after refinement wins.
    """
    tokens = list(order)
    optional = [False] * len(tokens)
    if tokens[0] != "intro":
        tokens.insert(0, "intro")
        optional.insert(0, True)
    if tokens[-1] != "outro":
        tokens.append("outro")
        optional.append(True)

    best, best_score = None, float("-inf")
    for seed in [{}] + seeds:
        sections, score = _align(tokens, optional, prefix, loud, times, novelty, seed)
        if sections is None:
            continue
        for _ in range(ALIGN_PASSES):
            refined, refined_score = _align(
                tokens, optional, prefix, loud, times, novelty, _prototypes(sections, units)
            )
            if refined is None or refined == sections:
                break
            sections, score = refined, refined_score
        if score > best_score:
            best, best_score = sections, score
    return best


def _chorus_seeds(rough, units):
    """Each block the audio repeats, as a guess at the chorus's sound."""
    letters = _repeat_groups(rough, units)
    seeds = []
    for letter in sorted(set(letters)):
        rows = [units[s:e] for (s, e, _), L in zip(rough, letters) if L == letter]
        if len(rows) >= 2:
            mean = np.vstack(rows).mean(axis=0)
            seeds.append({"chorus": mean / (np.linalg.norm(mean) + 1e-9)})
    return seeds


def _choruses_agree(sections, units):
    """True when the sections named chorus sound alike on average (or there is at most one)."""
    sigs = [_signature(units, s, e) for s, e, name in sections if name == "chorus"]
    pairs = [_similarity(a, b) for i, a in enumerate(sigs) for b in sigs[i + 1:]]
    return not pairs or float(np.mean(pairs)) >= REPEAT_SIMILARITY


def _split_by_audio(units, prefix, loud, times, novelty):
    duration = times[-1] - times[0]
    count = int(np.clip(round(duration / AUDIO_ONLY_SECTION_SECONDS), 3, 14))
    for k in range(count, 0, -1):
        sections, _ = _align(["section"] * k, [False] * k, prefix, loud, times, novelty, {})
        if sections is not None:
            return sections
    return [(0, len(units), "section")]


def _signature(units, s, e):
    """A section's overall sound and its opening sound, as unit vectors."""
    whole = units[s:e].mean(axis=0)
    opening = units[s:min(e, s + OPENING_BEATS)].mean(axis=0)
    return whole / (np.linalg.norm(whole) + 1e-9), opening / (np.linalg.norm(opening) + 1e-9)


def _similarity(a, b):
    """Sections match if they sound alike overall or start alike."""
    return max(float(a[0] @ b[0]), float(a[1] @ b[1]))


def _repeat_groups(sections, units):
    """Letter each section by which earlier one it sounds like (A, B, A, C...)."""
    letters, firsts = [], []
    for s, e, _ in sections:
        sig = _signature(units, s, e)
        sims = [_similarity(sig, first) for first in firsts]
        if sims and max(sims) >= REPEAT_SIMILARITY:
            letters.append(chr(65 + int(np.argmax(sims))))
        else:
            firsts.append(sig)
            letters.append(chr(64 + len(firsts)))
    return letters


def _name_by_audio(sections, letters, loudness, fades):
    """
    Name sections without a lyric sheet: the loudest block that repeats is the
    chorus, what leads into it is the verse (or a short pre-chorus), a
    one-off late section is the bridge, and quiet unique ends are intro/outro.
    """
    n = len(sections)
    names = ["section"] * n
    counts = {L: letters.count(L) for L in letters}
    repeated = [L for L in counts if counts[L] >= 2 and letters.index(L) > 0]
    if repeated:
        chorus = max(repeated, key=lambda L: np.mean([loudness[i] for i in range(n) if letters[i] == L]))
        for i in range(n):
            if letters[i] == chorus:
                names[i] = "chorus"
    if n > 1 and counts[letters[0]] == 1 and names[0] == "section":
        names[0] = "intro"
    if n > 2 and names[-1] == "section" and (counts[letters[-1]] == 1 or fades):
        names[-1] = "outro"
    chorus_at = [i for i in range(n) if names[i] == "chorus"]
    first_chorus = chorus_at[0] if chorus_at else n
    second_chorus = chorus_at[1] if len(chorus_at) > 1 else n
    for i in range(n):
        if names[i] != "section":
            continue
        leads_in = i + 1 < n and names[i + 1] == "chorus"
        seconds = sections[i][1] - sections[i][0]
        if i < first_chorus or (leads_in and counts[letters[i]] >= 2):
            names[i] = "pre-chorus" if leads_in and i > 0 and names[i - 1] == "verse" else "verse"
        elif counts[letters[i]] == 1 and i > second_chorus and "chorus" in names[i + 1:]:
            names[i] = "bridge"
        elif seconds > 0:
            names[i] = "verse" if counts[letters[i]] >= 2 else "instrumental"
    return names


def _merge_neighbors(sections, letters):
    """Join back-to-back sections that ended up with the same name."""
    merged, merged_letters = [], []
    for (s, e, name), letter in zip(sections, letters):
        if merged and merged[-1][2] == name:
            merged[-1] = (merged[-1][0], e, name)
            continue
        merged.append((s, e, name))
        merged_letters.append(letter)
    return merged, merged_letters


# ---------------------------------------------------------------------------
# Moments
# ---------------------------------------------------------------------------
def _per_second_db(y, sr):
    seconds = int(np.ceil(len(y) / sr))
    out = np.empty(seconds)
    for t in range(seconds):
        chunk = y[t * sr:(t + 1) * sr]
        out[t] = 20 * np.log10(np.sqrt(np.mean(chunk ** 2)) + 1e-9) if len(chunk) else -90.0
    return out


def _mean_db(db, a, b):
    a, b = max(0, int(np.floor(a))), min(len(db), int(np.ceil(b)))
    return float(db[a:b].mean()) if b > a else float("-inf")


def _snap(times, t):
    return float(times[int(np.argmin(np.abs(times - t)))])


def _cuts(times, start, end, duration, anchor="start"):
    """Edit points for each standard length, starting (or ending) on a beat."""
    cuts = {}
    for length in CUT_SECONDS:
        if length > duration:
            continue
        if anchor == "end":
            b = end
            fits = times[(times <= b - length + 0.25)]
            a = float(fits[-1]) if len(fits) else 0.0
            a = max(a, b - length) if b - a > length + 0.25 else a
        else:
            a = start if start + length <= duration else max(0.0, duration - length)
            fits = times[(times >= a) & (times <= a + length + 0.25)]
            b = float(fits[-1]) if len(fits) else min(duration, a + length)
        cuts[str(length)] = [round(float(a), 2), round(float(b), 2)]
    return cuts


def _pick_moments(sections, times, db, duration):
    """Named moments: hook, chorus lift, build-up, climax, breakdown, intro, outro."""
    found = []

    def add(kind, start, end, anchor="start"):
        start, end = max(0.0, start), min(duration, end)
        if end - start >= 3:
            found.append({"type": kind, "start": start, "end": end, "anchor": anchor})

    choruses = [(times[s], times[e]) for s, e, n in sections if n in ("chorus", "drop")]
    if choruses:
        a, b = choruses[0]
        add("vocal_hook", a, min(b, _snap(times, a + HOOK_SECONDS)))
    if len(choruses) > 1:
        a, b = max(choruses[1:], key=lambda c: _mean_db(db, *c))
        add("chorus_lift", a, min(b, _snap(times, a + MOMENT_MAX_SECONDS)))

    last_start = max(0.0, duration - CLIMAX_SECONDS)
    starts = times[times <= last_start] if (times <= last_start).any() else np.array([0.0])
    peak = max(starts, key=lambda a: _mean_db(db, a, a + CLIMAX_SECONDS))
    add("climax", float(peak), _snap(times, peak + CLIMAX_SECONDS))

    rises = []
    before_far, before_near = BUILD_BEFORE_SECONDS
    for i, (s, _, name) in enumerate(sections[1:], start=1):
        at = times[s]
        if at < before_far:
            continue
        rise = _mean_db(db, at, at + BUILD_PAYOFF_SECONDS) - _mean_db(db, at - before_far, at - before_near)
        if name in ("chorus", "drop"):
            rise += 1.0
        rises.append((rise, at, times[sections[i - 1][0]]))
    if rises:
        rise, at, previous_start = max(rises)
        if rise >= BUILD_MIN_RISE_DB:
            lead = max(previous_start, _snap(times, at - BUILD_LEAD_SECONDS))
            add("build_up", lead, _snap(times, at + BUILD_PAYOFF_SECONDS), anchor="end")

    if choruses:
        median = np.median(db[db > -80]) if (db > -80).any() else np.median(db)
        smooth = np.convolve(db, np.ones(3) / 3, mode="same")
        window = range(int(choruses[0][0]), int(duration * 0.9))
        quiet = [t for t in window if smooth[t] < median - BREAKDOWN_DROP_DB]
        if quiet:
            runs = np.split(np.array(quiet), np.where(np.diff(quiet) > 1)[0] + 1)
            run = max(runs, key=len)
            if len(run) >= BREAKDOWN_MIN_SECONDS:
                a = _snap(times, run[0])
                add("breakdown", a, min(_snap(times, run[-1] + 1), a + MOMENT_MAX_SECONDS))

    first, last = sections[0], sections[-1]
    if first[2] == "intro":
        add("intro", 0.0, min(times[first[1]], MOMENT_MAX_SECONDS))
    outro_start = times[last[0]] if last[2] == "outro" else duration - CLIMAX_SECONDS
    add("outro", max(outro_start, duration - MOMENT_MAX_SECONDS), duration, anchor="end")

    kept = []
    for m in sorted(found, key=lambda m: MOMENT_PRIORITY.index(m["type"])):
        for k in kept:
            shared = min(m["end"], k["end"]) - max(m["start"], k["start"])
            if shared > OVERLAP_MERGE * min(m["end"] - m["start"], k["end"] - k["start"]):
                k.setdefault("also", []).append(m["type"])
                break
        else:
            kept.append(m)
    return sorted(kept, key=lambda m: m["start"])


def _ending(db):
    tail = db[-FADE_WINDOW_SECONDS:]
    return "fade" if len(tail) > 1 and tail[-1] - tail[0] < -FADE_DROP_DB else "cold"


def _loudness_lufs(y, sr):
    try:
        import pyloudnorm

        value = pyloudnorm.Meter(sr).integrated_loudness(y)
        return round(float(value), 1) if np.isfinite(value) else None
    except ImportError:
        return None


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def measure_song(y, sr, section_order=None):
    """
    Sections and moments for one song.

    Args:
      y: mono samples at `sr`.
      section_order: optional lyric-sheet headers in order; unknown headers are ignored.

    Returns a JSON-ready dict; every time is in seconds from the start.
    """
    duration = len(y) / sr
    tempo, bounds, times = _beat_grid(y, sr)
    units, beat_db = _beat_features(y, sr, bounds)
    prefix = np.vstack([np.zeros(units.shape[1]), np.cumsum(units, axis=0)])
    loud_z = (beat_db - beat_db.mean()) / (beat_db.std() + 1e-9)
    loud = np.concatenate([[0.0], np.cumsum(loud_z)])
    novelty = _novelty(units)

    order = [n for n in (normalize_label(x) for x in (section_order or [])) if n]
    rough = _split_by_audio(units, prefix, loud, times, novelty)
    sections = None
    if order:
        seeds = _chorus_seeds(rough, units) if "chorus" in order else []
        sections = _split_by_lyrics(order, units, prefix, loud, times, novelty, seeds)
        if sections is not None and not _choruses_agree(sections, units):
            sections = None  # the sheet does not fit this recording; name from the audio instead
    names_from = "lyrics" if sections else "audio"
    if sections is None:
        sections = rough

    letters = _repeat_groups(sections, units)
    loudness = [float(beat_db[s:e].mean()) for s, e, _ in sections]
    db = _per_second_db(y, sr)
    ending = _ending(db)
    if names_from == "audio":
        names = _name_by_audio(sections, letters, loudness, ending == "fade")
        sections = [(s, e, n) for (s, e, _), n in zip(sections, names)]
    sections, letters = _merge_neighbors(sections, letters)

    lo, hi = np.percentile(db, 5), np.percentile(db, 98)
    energy = np.clip((db - lo) / (hi - lo + 1e-9), 0, 1)

    moments = []
    for m in _pick_moments(sections, times, db, duration):
        a, b = m["start"], m["end"]
        inside = next((n for s, e, n in sections if times[s] <= a + 0.01 < times[e]), sections[-1][2])
        moment = {
            "type": m["type"],
            "start": round(a, 2),
            "end": round(b, 2),
            "section": inside,
            "energy": int(round(100 * energy[int(a):max(int(a) + 1, int(b))].mean())),
            "cuts": _cuts(times, a, b, duration, m["anchor"]),
        }
        if "also" in m:
            moment["also"] = m["also"]
        moments.append(moment)

    return {
        "measured_with": MEASURE_VERSION,
        "duration_seconds": round(duration, 2),
        "tempo_bpm": round(tempo, 1),
        "loudness_lufs": _loudness_lufs(y, sr),
        "ending": ending,
        "names_from": names_from,
        "sections": [
            {
                "label": name,
                "start": round(float(times[s]), 2),
                "end": round(float(times[e]), 2),
                "group": letter,
                "energy": int(round(100 * energy[int(times[s]):max(int(times[s]) + 1, int(times[e]))].mean())),
            }
            for (s, e, name), letter in zip(sections, letters)
        ],
        "moments": moments,
        "energy_curve": [int(round(100 * v)) for v in energy],
    }


def measure_file(path, section_order=None, tempo_hint=None):
    """
    The full measurement for one audio file: measure_song on the mono mix plus
    the extended fields from song_measure.py (loudness, bands, fingerprint,
    key, drops, edit points), with the tracked tempo reconciled to `tempo_hint`.
    """
    from song_measure import load_stereo, measure_signal

    y, sr = load_stereo(path)
    return measure_signal(y, sr, section_order, tempo_hint, audio_path=path)


if __name__ == "__main__":
    import json
    import os
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # song_measure.py, under python -I
    args = sys.argv[2:]
    hint = None
    if args[:1] == ["--tempo-hint"]:
        hint, args = float(args[1]), args[2:]
    print(json.dumps(measure_file(sys.argv[1], args or None, hint), indent=1))
