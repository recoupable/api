"""
song_measure.py
---------------
Extends the song-moments measurement (song_moments.py) with every number a
song report draws: loudness and peaks, the stereo image, a seven-band
spectrum, a six-axis sound fingerprint, key, time signature, valence and
arousal, mute and breakdown drops, a chord-loop estimate, typed edit points,
how the song ends (fade, stop, or stop with a tail), and each section's
arrangement density with plain-language notes on where the band thins. The
tracked tempo can be reconciled against a hint from metadata or a listening
model.

No language model is involved. Pure analysis code with no Modal imports;
ffmpeg's ebur128 filter supplies true peak and integrated loudness when a
file path is given, and is skipped (true peak unknown) otherwise.

The fingerprint and band reference constants were calibrated on two songs;
treat them as a starting point that a corpus pass should replace.
"""

import subprocess

import numpy as np

from song_moments import SAMPLE_RATE, measure_song

# ---------------------------------------------------------------------------
# Configuration — all tunables live here (no magic numbers inline)
# ---------------------------------------------------------------------------
EXTENDED_VERSION = "extended-2026-11-04.2"  # appended to the base version in measured_with
EXTENDED_SAMPLE_RATE = 44100               # the spectrum, bands and fingerprint assume 44.1 kHz
EBUR128_TIMEOUT_SECONDS = 120

# A hint reconciles the tracker's tempo when one of these multiples lands within 8 %.
TEMPO_RATIOS = (1, 0.5, 2, 0.75, 4 / 3, 2 / 3, 1.5)
TEMPO_MATCH = 0.08

BROADCAST_MAX_TRUE_PEAK_DBTP = -1.0
BROADCAST_LUFS_RANGE = (-16, -7)

STFT_SIZE = 4096
STFT_HOP = 2048
BANDS = [  # the seven bands the report draws, with the instrument annotation vocabulary
    ("sub", 20, 60), ("low", 60, 250), ("low_mid", 250, 500), ("mid", 500, 2000),
    ("high_mid", 2000, 6000), ("high", 6000, 12000), ("air", 12000, 22050),
]
BAND_REFERENCE_PCT = (18, 32, 12, 17, 10, 7, 4)  # typical pop energy split, same bands
BAND_LEVEL_SPAN_DB = 24     # +/-12 dB around the reference maps to the 0-100 bar
BAND_CLEAR_DB = 4           # within this many dB of the reference reads "clear"
ROLLOFF_PERCENT = 0.95

KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
MODE_VALENCE = 0.12          # major lifts valence, minor lowers it, by this much

DROP_FRAMES_PER_BEAT = 8     # 1/8-beat frames: a one-beat mute at 96 BPM is still 8 frames
DROP_MIN_HOP = 256
DROP_LOOKBACK_BEATS = 8      # a drop is measured against the preceding eight beats
DROP_ENTER_DB = 8            # falls this far under the local median to start a drop...
DROP_EXIT_DB = 5             # ...and ends once back within this
DROP_MIN_BEATS = 0.5
BREAKDOWN_MIN_BEATS = 2      # shorter is a "mute" (a zero-bleed cut), longer a "breakdown"
DROP_SKIP_BEATS = 4          # after a drop, look again this many beats later
SONG_DROP_ENTER_DB = 10      # whole-song breakdown test: under the song's median by this...
SONG_DROP_EXIT_DB = 7        # ...until back within this
DROP_MERGE_BEATS = 3         # breakdowns closer than this are one pull-back with a breath
END_GUARD_SECONDS = 3        # no drops in the last few seconds
EDIT_POINT_MUTES = 3         # only the deepest mutes become edit points

BEATS_PER_BAR = 4
CHORD_LOOP_BARS = 4
TIME_SIGNATURE_MARGIN = 1.25  # 3/4 must beat 4/4 periodicity by this factor
MIN_BARS_FOR_METER = 4

ARRANGEMENT_HIGH_HZ = 2000       # a section's high share is its spectral energy at or above this...
ARRANGEMENT_SUB_HZ = 120         # ...and its sub share the energy below this
THIN_FALL = 0.35                 # "band thins": percussive share and onset rate both this far under the median section
DRUMS_OUT_ONSETS_PER_S = 1.0     # "drums drop out": fewer onsets a second than this...
DRUMS_OUT_LEVEL_DB = 6           # ...while the section's RMS stays within this of the median section

# Endings, read from the per-second energy curve against its median (non-silent) second.
ENDING_LOUD_SHARE = 0.5          # the last second at or above this share of the median is the last loud one
ENDING_SILENT_SHARE = 0.1        # the final run of seconds under this share is the closing silence
ENDING_TAIL_SHARES = (0.05, 0.3)  # a low tail sits in this band of the median; a stop falls straight into it
TAIL_MIN_SECONDS = 3             # a tail this long after a stop makes it a stop with tail
FADE_MIN_SECONDS = 4             # a gradual decay this long or longer is a fade


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def _mmss(t):
    return f"{int(t // 60)}:{int(t % 60):02d}"


def _clamp01(x):
    return float(min(1.0, max(0.0, x)))


def _energy(x):
    """Sum of squares, in float64."""
    return float(np.sum(np.asarray(x, dtype=np.float64) ** 2))


def _json_ready(value):
    """Plain Python values only, with NaN and infinity as None, so the result is strict JSON."""
    if isinstance(value, dict):
        return {k: _json_ready(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_ready(v) for v in value]
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not np.isfinite(value):
        return None
    return value


def _as_stereo(y):
    """(2, n) float32 from mono, stereo or multichannel samples (first two channels)."""
    y = np.asarray(y, dtype=np.float32)
    if y.ndim == 1:
        return np.vstack([y, y])
    if y.shape[0] == 1:
        return np.vstack([y[0], y[0]])
    return y[:2]


def _base_mono(y_stereo, sr):
    """The mono signal at song_moments' rate, as librosa.load(mono=True) would give it."""
    import librosa

    mono = librosa.to_mono(_as_stereo(y_stereo))
    return mono if sr == SAMPLE_RATE else librosa.resample(mono, orig_sr=sr, target_sr=SAMPLE_RATE)


def load_stereo(path, max_seconds=None):
    """Decode a file as (2, n) samples at EXTENDED_SAMPLE_RATE, at most `max_seconds` long."""
    import librosa

    y, sr = librosa.load(path, sr=EXTENDED_SAMPLE_RATE, mono=False, duration=max_seconds)
    return _as_stereo(y), sr


# ---------------------------------------------------------------------------
# Tempo
# ---------------------------------------------------------------------------
def _reconcile_tempo(tracked, hint):
    """
    The tracker often locks onto a multiple of the real tempo. With a hint
    (metadata or a listening model), try t, t/2, 2t, 3t/4, 4t/3, 2t/3, 3t/2
    and keep the one within 8 % of the hint; if none is, trust the hint.
    """
    if not hint:
        return tracked, "beat tracker"
    best = min((tracked * r for r in TEMPO_RATIOS), key=lambda c: abs(c - hint))
    if abs(best - hint) / hint <= TEMPO_MATCH:
        return round(best, 1), f"beat tracker {tracked:g} reconciled to hint {hint:g}"
    return float(hint), f"hint {hint:g}; beat tracker {tracked:g} disagreed"


# ---------------------------------------------------------------------------
# Loudness, stereo and spectrum
# ---------------------------------------------------------------------------
def _parse_ebur128(text):
    """Integrated LUFS, loudness range and true peak from ffmpeg ebur128's closing summary."""
    vals = {}
    for line in text.splitlines()[::-1]:
        s = line.strip()
        for prefix, key in (("I:", "lufs"), ("LRA:", "lra"), ("Peak:", "true_peak")):
            if s.startswith(prefix) and key not in vals:
                try:
                    value = float(s.split()[1])
                except (IndexError, ValueError):
                    continue
                if np.isfinite(value):
                    vals[key] = value
    return vals


def _ebur128(path, seconds):
    """Run ffmpeg ebur128 (true peak on) over the first `seconds`; {} when ffmpeg is unavailable or fails."""
    command = [
        "ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-t", f"{seconds:.3f}", "-i", path,
        "-af", "ebur128=peak=true", "-f", "null", "-",
    ]
    try:
        run = subprocess.run(command, capture_output=True, text=True, timeout=EBUR128_TIMEOUT_SECONDS, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return {}
    return _parse_ebur128(run.stderr) if run.returncode == 0 else {}


def _loudness(y, mono, ebur128, base_lufs):
    """
    One loudness figure: the stereo ebur128 integrated value replaces the mono
    22 kHz estimate song_moments carries, so the two never disagree downstream.
    Without ebur128 the base estimate stands and true peak is unknown.
    """
    peak_db = 20 * np.log10(float(np.max(np.abs(y))) + 1e-12)
    rms_db = 20 * np.log10(float(np.sqrt(np.mean(mono.astype(np.float64) ** 2))) + 1e-12)
    lufs = ebur128.get("lufs", base_lufs)
    true_peak = ebur128.get("true_peak")
    broadcast_ready = None
    if lufs is not None and true_peak is not None:
        low, high = BROADCAST_LUFS_RANGE
        broadcast_ready = bool(true_peak <= BROADCAST_MAX_TRUE_PEAK_DBTP and low <= lufs <= high)
    return {
        "lufs": round(lufs, 1) if lufs is not None else None,
        "true_peak_dbtp": round(true_peak, 1) if true_peak is not None else None,
        "sample_peak_dbfs": round(peak_db, 2),
        "crest_factor_db": round(peak_db - rms_db, 1),
        "loudness_range_lu": ebur128.get("lra"),
        "broadcast_ready": broadcast_ready,
    }


def _stereo(left, right, mono, side):
    """Left/right correlation and side energy relative to mid (0 = mono)."""
    side_rms = np.sqrt(np.mean(side.astype(np.float64) ** 2))
    width = float(side_rms / (np.sqrt(np.mean(mono.astype(np.float64) ** 2)) + 1e-12))
    corr = float(np.corrcoef(left, right)[0, 1])
    return {"lr_correlation": round(corr, 3), "side_to_mid": round(width, 3)}


def _band_profile(power, side, sr):
    """
    Each band's share of the mix's energy, its side energy, and a level against the pop reference.
    `power` is the mono mix's power spectrogram (STFT_SIZE, STFT_HOP).
    """
    import librosa

    side_power = np.abs(librosa.stft(side, n_fft=STFT_SIZE, hop_length=STFT_HOP)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=STFT_SIZE)
    total = float(power.sum()) + 1e-12
    bands = []
    for name, lo, hi in BANDS:
        rows = (freqs >= lo) & (freqs < hi)
        band = float(power[rows].sum())
        bands.append({
            "band": name, "lo_hz": lo, "hi_hz": hi,
            "share_pct": round(band / total * 100, 1),
            "side_pct": round(float(side_power[rows].sum()) / (band + 1e-12) * 100, 1),
        })
    # relative level per band vs a flat-ish pop reference (log share), 0-100 for the bar chart
    shares = np.array([b["share_pct"] for b in bands]) + 1e-3
    relative_db = 10 * np.log10(shares / np.array(BAND_REFERENCE_PCT))
    for b, r in zip(bands, relative_db):
        b["level_pct"] = int(round(_clamp01(0.5 + r / BAND_LEVEL_SPAN_DB) * 100))
        b["status"] = "clear" if abs(r) < BAND_CLEAR_DB else ("heavy" if r > 0 else "light")
    return bands


# ---------------------------------------------------------------------------
# Fingerprint, key and mood
# ---------------------------------------------------------------------------
def _fingerprint_inputs(mono, sr, duration, split, onsets):
    """
    The spectral and rhythmic measurements the fingerprint is built from.
    `split` is the mix's (harmonic, percussive) separation; `onsets` are onset times in seconds.
    """
    import librosa

    harmonic, percussive = split
    h, p = _energy(harmonic), _energy(percussive)
    return {
        "flatness": float(np.mean(librosa.feature.spectral_flatness(y=mono))),
        "contrast_db": float(np.mean(librosa.feature.spectral_contrast(y=mono, sr=sr))),
        "zcr_std": float(np.std(librosa.feature.zero_crossing_rate(mono))),
        "perc_ratio": p / (h + p + 1e-12),
        "onsets_per_s": len(onsets) / max(duration, 1),
    }


def _fingerprint(inputs, centroid, energy_mean, width, lufs, tempo):
    """Six axes, 0 = left label, 1 = right label."""
    # Calibrated 2026-11-04 on two pop masters (flatness 0.01–0.04, contrast 18–24 dB,
    # 4 onsets/s, centroid 2–3 kHz at 44.1 kHz). A corpus pass should replace these constants.
    loudness_term = 0.08 * (lufs + 12) / 6 if lufs is not None else 0.0
    return {
        "organic_electronic": _clamp01(0.2 + 6 * inputs["flatness"] + 0.5 * (inputs["perc_ratio"] - 0.25)),
        "sparse_dense": _clamp01(inputs["onsets_per_s"] / 8.0),
        "dark_bright": _clamp01((centroid - 1200) / 3200),
        "intimate_anthemic": _clamp01(0.25 + 0.4 * (energy_mean / 100) + 0.5 * (width - 0.3) + loudness_term),
        "smooth_textured": _clamp01(0.15 + (inputs["contrast_db"] - 15) / 30 + (inputs["zcr_std"] - 0.04) * 4),
        "slow_fast": _clamp01((tempo - 50) / 110),
    }


def _estimate_key(chroma_mean):
    """Best Krumhansl major/minor profile for the song's average chroma; confidence is the correlation."""
    best = (-np.inf, KEY_NAMES[0], "major")
    for profile, mode in ((MAJOR_PROFILE, "major"), (MINOR_PROFILE, "minor")):
        for i in range(12):
            corr = float(np.corrcoef(np.roll(profile, i), chroma_mean)[0, 1])
            if np.isfinite(corr) and corr > best[0]:
                best = (corr, KEY_NAMES[i], mode)
    confidence = round(best[0], 2) if np.isfinite(best[0]) else None
    return {"tonic": best[1], "mode": best[2], "confidence": confidence}


def _valence_arousal(energy_mean, fingerprint, mode):
    """The measured half of mood; the listening model's mood words refine valence later."""
    arousal = _clamp01(0.25 + 0.4 * (energy_mean / 100) + 0.35 * fingerprint["slow_fast"])
    lean = MODE_VALENCE if mode == "major" else -MODE_VALENCE
    valence = _clamp01(0.5 + lean + 0.1 * (fingerprint["dark_bright"] - 0.5))
    return valence, arousal


# ---------------------------------------------------------------------------
# Ending
# ---------------------------------------------------------------------------
def _ending_detail(energy_curve, duration):
    """
    How the song ends, from the per-second energy curve (energy_curve[i] covers second i to i+1),
    against the median non-silent second. After the last second at 50 % or more of the median,
    the closing silence is the final run of seconds under 10 % (none when the file ends on sound).
      stop            the next second is already under 30 % (the band stops): {stop_at, silent_from};
      stop_with_tail  a stop after which 5-30 % seconds add up to three or more before the closing
                      silence (a ringing chord, a room, a short coda): {stop_at, tail_until};
      fade            no stop, and four seconds or more from the last loud second to the closing
                      silence: {from, silent_from};
      stop            otherwise, a decay too quick to be a fade.
    Each carries `type` and `mmss` (of `from` or `stop_at`). Times are clamped to the duration.
    """
    e = np.asarray(energy_curve, dtype=float)
    median = float(np.median(e[e > 0])) if np.any(e > 0) else 1.0
    low, high = ENDING_TAIL_SHARES
    loud = np.flatnonzero(e >= ENDING_LOUD_SHARE * median)
    last_loud = int(loud[-1]) if len(loud) else len(e) - 1
    silence_at = len(e)
    while silence_at > last_loud + 1 and e[silence_at - 1] < ENDING_SILENT_SHARE * median:
        silence_at -= 1
    after = e[last_loud + 1:silence_at]
    stops = last_loud + 1 < len(e) and e[last_loud + 1] < high * median
    tail_seconds = int(np.sum((after >= low * median) & (after < high * median)))
    end_of_loud = min(float(last_loud + 1), duration)
    silent = min(float(silence_at), duration)
    if stops and tail_seconds >= TAIL_MIN_SECONDS:
        detail = {"type": "stop_with_tail", "stop_at": end_of_loud, "tail_until": silent}
    elif not stops and silence_at - last_loud >= FADE_MIN_SECONDS:
        detail = {"type": "fade", "from": end_of_loud, "silent_from": silent}
    else:
        detail = {"type": "stop", "stop_at": end_of_loud, "silent_from": silent}
    detail["mmss"] = _mmss(end_of_loud)
    return detail


# ---------------------------------------------------------------------------
# Drops
# ---------------------------------------------------------------------------
def _merge_breakdowns(drops, beat):
    """Merge breakdowns separated by less than three beats (a breath inside one pull-back)."""
    merged = []
    for d in sorted(drops, key=lambda d: d["start"]):
        prev = merged[-1] if merged else None
        if (
            prev and prev["type"] == "breakdown" and d["type"] == "breakdown"
            and d["start"] - prev["end"] < DROP_MERGE_BEATS * beat
        ):
            prev["end"] = d["end"]
            prev["beats"] = round((prev["end"] - prev["start"]) / beat, 1)
            prev["depth_db"] = max(prev["depth_db"], d["depth_db"])
        else:
            merged.append(dict(d))
    return merged


def _find_drops(mono, sr, tempo, duration, ending_start, first_end):
    """
    Drops: RMS falling well below the preceding eight beats and staying there,
    before `ending_start` (where the fade begins or the band stops).
    A "mute" is shorter than two beats (the editor's zero-bleed cut); a "breakdown"
    is two beats or longer (the band pulling back). Measured on 1/8-beat frames so a
    single-beat mute in a 96 BPM song (0.6 s) is still eight frames wide. A drop must
    come back before `ending_start`; one that does not is the ending itself, not a drop.
    """
    import librosa

    beat = 60.0 / max(tempo, 1)
    win = DROP_FRAMES_PER_BEAT
    hop = max(DROP_MIN_HOP, int(beat / win * sr))
    rms_db = 20 * np.log10(librosa.feature.rms(y=mono, frame_length=hop * 2, hop_length=hop)[0] + 1e-9)
    times = librosa.frames_to_time(np.arange(len(rms_db)), sr=sr, hop_length=hop)
    last = len(times) - 1
    lookback = DROP_LOOKBACK_BEATS * win

    def drop(kind, i, j, reference):
        length = times[min(j, last)] - times[i]
        return {
            "type": kind,
            "start": round(float(times[i]), 2),
            "end": round(float(times[min(j, last)]), 2),
            "beats": round(float(length / beat), 1),
            "depth_db": round(float(reference - rms_db[i:max(j, i + 1)].min()), 1),
        }

    med = np.array([np.median(rms_db[max(0, i - lookback):max(1, i - win // 2)]) for i in range(len(rms_db))])
    drops, i = [], lookback
    while i < len(rms_db):
        if rms_db[i] < med[i] - DROP_ENTER_DB and times[i] < min(duration - END_GUARD_SECONDS, ending_start):
            j = i
            while j < len(rms_db) and rms_db[j] < med[i] - DROP_EXIT_DB:
                j += 1
            if j > last or times[j] >= ending_start:
                break  # does not come back before the ending: it is the ending
            length = times[min(j, last)] - times[i]
            if length >= beat * DROP_MIN_BEATS:
                kind = "breakdown" if length >= BREAKDOWN_MIN_BEATS * beat else "mute"
                drops.append(drop(kind, i, j, med[i]))
            i = j + DROP_SKIP_BEATS * win
        else:
            i += 1

    # Breakdowns against the whole song: a stretch of two beats or more sitting ten dB
    # under the song's median, outside the first section and the ending. The local test
    # above misses a drop that follows an already-quiet bridge.
    song_med = float(np.median(rms_db[lookback:])) if len(rms_db) > lookback else float(np.median(rms_db))
    i = 0
    while i < len(rms_db):
        if rms_db[i] < song_med - SONG_DROP_ENTER_DB and first_end < times[i] < ending_start:
            j = i
            while j < len(rms_db) and rms_db[j] < song_med - SONG_DROP_EXIT_DB:
                j += 1
            if j > last or times[j] >= ending_start:
                break  # does not come back before the ending: it is the ending
            length = times[min(j, last)] - times[i]
            overlaps = any(d["start"] - 1 <= times[i] <= d["end"] + 1 for d in drops)
            if length >= BREAKDOWN_MIN_BEATS * beat and not overlaps:
                drops.append(drop("breakdown", i, j, song_med))
            i = j + 1
        else:
            i += 1

    drops = _merge_breakdowns(drops, beat)
    for d in drops:
        d["mmss"] = _mmss(d["start"])
    return drops


# ---------------------------------------------------------------------------
# Harmony and meter
# ---------------------------------------------------------------------------
def _chord_loop(beat_chroma, key):
    """
    One chord per bar from the key's diatonic triads, then the most common
    four-bar cycle. Diatonic-only matching removes most of the noise a free
    24-template search produces; the model's own chord answer is a second vote.
    """
    tonic = KEY_NAMES.index(key["tonic"])
    if key["mode"] == "major":
        degrees, qualities = [0, 2, 4, 5, 7, 9, 11], ["", "m", "m", "", "", "m", "dim"]
    else:
        degrees, qualities = [0, 2, 3, 5, 7, 8, 10], ["m", "dim", "", "m", "m", "", ""]
    templates = {}
    for degree, quality in zip(degrees, qualities):
        root = (tonic + degree) % 12
        third = 4 if quality == "" else 3
        fifth = 6 if quality == "dim" else 7
        v = np.zeros(12)
        v[[root, (root + third) % 12, (root + fifth) % 12]] = 1
        templates[KEY_NAMES[root] + quality] = v / np.linalg.norm(v)

    n_beats = beat_chroma.shape[1]
    chords = []
    for b in range(0, n_beats - BEATS_PER_BAR + 1, BEATS_PER_BAR):
        c = beat_chroma[:, b:b + BEATS_PER_BAR].mean(axis=1)
        c = c / (np.linalg.norm(c) + 1e-9)
        chords.append(max(templates, key=lambda k: float(np.dot(templates[k], c))))
    loops = {}
    for i in range(max(0, len(chords) - CHORD_LOOP_BARS + 1)):
        loop = " ".join(chords[i:i + CHORD_LOOP_BARS])
        loops[loop] = loops.get(loop, 0) + 1
    top_loop, count = max(loops.items(), key=lambda kv: kv[1]) if loops else ("", 0)
    return {
        "dominant_loop": top_loop,
        "loop_share": round(count / max(1, len(chords) - CHORD_LOOP_BARS + 1), 2),
        "distinct_chords": len(set(chords)),
        "bars": len(chords),
        "confidence": "low",
    }


def _time_signature(beat_strength):
    """Compare 3- and 4-beat periodicity of beat strength."""

    def period_score(p):
        n = len(beat_strength) // p * p
        if n < p * MIN_BARS_FOR_METER:
            return 0.0
        grid = beat_strength[:n].reshape(-1, p).mean(axis=0)
        return float(grid.max() - grid.mean())

    return "3/4" if period_score(3) > TIME_SIGNATURE_MARGIN * period_score(4) else "4/4"


# ---------------------------------------------------------------------------
# Arrangement density
# ---------------------------------------------------------------------------
def _arrangement(sections, mono, split, onsets, power, sr):
    """
    Per section: the percussive share of its energy (from the harmonic/percussive
    split), onsets per second, the share of its spectral energy at or above 2 kHz
    and below 120 Hz, and its RMS level in dB. Shows a section thinning out even
    when it does not get quieter. One dict per section, values to one decimal.
    """
    import librosa

    harmonic, percussive = split
    freqs = librosa.fft_frequencies(sr=sr, n_fft=STFT_SIZE)
    high_rows, sub_rows = freqs >= ARRANGEMENT_HIGH_HZ, freqs < ARRANGEMENT_SUB_HZ
    frame_times = librosa.frames_to_time(np.arange(power.shape[1]), sr=sr, hop_length=STFT_HOP)
    onsets = np.asarray(onsets)
    result = []
    for section in sections:
        start, end = float(section["start"]), float(section["end"])
        a, b = int(start * sr), int(end * sr)
        h, p = _energy(harmonic[a:b]), _energy(percussive[a:b])
        spectrum = power[:, (frame_times >= start) & (frame_times < end)]
        total = float(spectrum.sum()) + 1e-12
        rms = np.sqrt(_energy(mono[a:b]) / max(b - a, 1))
        result.append({
            "percussive_pct": round(p / (h + p + 1e-12) * 100, 1),
            "onsets_per_s": round(float(np.sum((onsets >= start) & (onsets < end))) / max(end - start, 1e-6), 1),
            "high_pct": round(float(spectrum[high_rows].sum()) / total * 100, 1),
            "sub_pct": round(float(spectrum[sub_rows].sum()) / total * 100, 1),
            "rms_db": round(float(20 * np.log10(rms + 1e-9)), 1),
        })
    return result


def _arrangement_notes(sections, ending_start=None):
    """
    Plain-language notes from each section's `arrangement`, against the median section:
      "sparse open"             the first section is both the quietest and the brightest;
      "drums drop out at m:ss"  under one onset a second while the RMS stays within 6 dB of the median;
      "band thins at m:ss"      percussive share and onset rate both more than 35 % under the median
                                (left out where the drums drop out, the more specific note).
    The last two describe a change, so the first section, which has nothing before it, gets neither.
    Sections lying mostly past `ending_start` (where the fade begins or the band stops) are the
    ending, which ending_detail describes; they are left out of the notes and the medians.
    """
    if ending_start is not None:
        sections = [s for s in sections if (s["start"] + s["end"]) / 2 < ending_start]
    if len(sections) < 2:
        return []
    values = [s["arrangement"] for s in sections]
    median = {k: float(np.median([v[k] for v in values])) for k in ("percussive_pct", "onsets_per_s", "rms_db")}
    keep = 1 - THIN_FALL
    notes = []
    first = values[0]
    if first["rms_db"] <= min(v["rms_db"] for v in values) and first["high_pct"] >= max(v["high_pct"] for v in values):
        notes.append("sparse open")
    for section, v in zip(sections[1:], values[1:]):
        at = _mmss(section["start"])
        if v["onsets_per_s"] < DRUMS_OUT_ONSETS_PER_S and abs(v["rms_db"] - median["rms_db"]) <= DRUMS_OUT_LEVEL_DB:
            notes.append(f"drums drop out at {at}")
        elif all(v[k] < keep * median[k] for k in ("percussive_pct", "onsets_per_s")):
            notes.append(f"band thins at {at}")
    return notes


# ---------------------------------------------------------------------------
# Edit points
# ---------------------------------------------------------------------------
def _ending_point(ending, duration):
    """The closing edit point: where the fade begins, or where the band stops (and any dead air after)."""
    if ending["type"] == "fade":
        return {"type": "out", "time": ending["from"], "name": "Fade begins",
                "note": f"Fades over {round(ending['silent_from'] - ending['from'])} s; needs no tail edit."}
    if ending["type"] == "stop_with_tail":
        note = f"Cold stop; a low tail runs to {_mmss(ending['tail_until'])}, then silence."
    elif ending["silent_from"] < duration:
        note = f"Cold stop; silence from {_mmss(ending['silent_from'])}. Trim the dead air."
    else:
        note = "Cold stop at the end of the file."
    return {"type": "out", "time": ending["stop_at"], "name": "Band stops", "note": note}


def _edit_points(sections, drops, ending, duration):
    """Typed in/out points from chorus entries and exits, drops, and the ending (an _ending_detail)."""
    points = []
    if sections:
        points.append({"type": "in", "time": 0.0, "name": f"Cold open ({sections[0]['label']})",
                       "note": "Starts clean from the top."})
    for a, b in zip(sections, sections[1:]):
        if b["label"] == "chorus" and a["label"] != "chorus":
            points.append({"type": "in", "time": b["start"], "name": f"{b['label'].title()} drop",
                           "note": f"Full entry into the {b['label']} after the {a['label']}."})
        if a["label"] == "chorus" and b["label"] != "chorus":
            points.append({"type": "out", "time": b["start"], "name": f"{a['label'].title()} cut point",
                           "note": f"End of the {a['label']} before the {b['label']}; cut or dip here."})
    deepest_mutes = sorted((d for d in drops if d["type"] == "mute"), key=lambda d: -d["depth_db"])[:EDIT_POINT_MUTES]
    for d in drops:
        if d["type"] == "mute":
            if d in deepest_mutes:
                points.append({"type": "out", "time": d["start"], "name": "Mute drop",
                               "note": f"{d['depth_db']} dB dip for {d['beats']} beats; a zero-bleed edit."})
        else:
            points.append({"type": "out", "time": d["start"], "name": "Breakdown",
                           "note": f"Band pulls back {d['depth_db']} dB for {round(d['end'] - d['start'], 1)} s."})
            points.append({"type": "in", "time": d["end"], "name": "Re-entry after the breakdown",
                           "note": "Full band returns; lands as a hit."})
    if sections:
        points.append(_ending_point(ending, duration))
    points.sort(key=lambda e: e["time"])
    for e in points:
        e["mmss"] = _mmss(e["time"])
    return points


# ---------------------------------------------------------------------------
# Entry points
# ---------------------------------------------------------------------------
def measure_extended(y_stereo, sr, base, tempo_hint=None, audio_path=None):
    """
    The base measurement plus the extended fields.

    Args:
      y_stereo: (2, n) samples at `sr` (mono is duplicated); EXTENDED_SAMPLE_RATE is expected.
      base: what song_moments.measure_song returned for the same audio; not modified.
      tempo_hint: optional BPM from metadata or a listening model (see _reconcile_tempo).
      audio_path: the decoded file, for ffmpeg ebur128; without it true peak is None.

    Returns a JSON-ready dict: every base field (tempo_bpm reconciled, loudness_lufs
    replaced by the ebur128 figure when there is one, `ending` re-read from the
    energy curve with `ending_detail` beside it, each section with its
    `arrangement` added) plus the extended fields.
    """
    import librosa

    y = _as_stereo(y_stereo)
    left, right = y[0], y[1]
    mono = (left + right) / 2
    side = (left - right) / 2
    duration = float(base["duration_seconds"])
    tempo, tempo_note = _reconcile_tempo(base["tempo_bpm"], tempo_hint)
    sections = base.get("sections") or []
    energy = np.array(base.get("energy_curve") or [0], dtype=float)

    ebur128 = _ebur128(audio_path, y.shape[1] / sr) if audio_path else {}
    loudness = _loudness(y, mono, ebur128, base.get("loudness_lufs"))
    stereo = _stereo(left, right, mono, side)
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=mono, sr=sr)))
    rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=mono, sr=sr, roll_percent=ROLLOFF_PERCENT)))
    power = np.abs(librosa.stft(mono, n_fft=STFT_SIZE, hop_length=STFT_HOP)) ** 2  # bands and arrangement
    onset_env = librosa.onset.onset_strength(y=mono, sr=sr)  # onsets and beat strength
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, units="time")
    split = librosa.effects.hpss(mono)  # the slow step: one split serves the fingerprint and the arrangement
    inputs = _fingerprint_inputs(mono, sr, duration, split, onsets)
    arrangement = _arrangement(sections, mono, split, onsets, power, sr)
    del split  # the largest intermediates; free them before the chroma pass
    sections = [{**s, "arrangement": a} for s, a in zip(sections, arrangement)]
    fingerprint = _fingerprint(inputs, centroid, energy.mean(), stereo["side_to_mid"], loudness["lufs"], tempo)

    chroma = librosa.feature.chroma_cqt(y=mono, sr=sr)
    key = _estimate_key(chroma.mean(axis=1))
    valence, arousal = _valence_arousal(energy.mean(), fingerprint, key["mode"])

    ending = _ending_detail(base.get("energy_curve") or [], duration)
    ending_start = ending["from"] if ending["type"] == "fade" else ending["stop_at"]
    first_end = float(sections[1]["start"]) if len(sections) > 1 else 0.0
    drops = _find_drops(mono, sr, tempo, duration, ending_start, first_end)

    beats = librosa.beat.beat_track(y=mono, sr=sr, bpm=tempo, units="frames")[1]
    beat_chroma = librosa.util.sync(chroma, beats, aggregate=np.median, pad=False)
    beat_strength = librosa.util.sync(onset_env[None, :], beats, aggregate=np.mean, pad=False)[0]

    result = dict(base)
    result.update({
        "measured_with": f"{base['measured_with']}+{EXTENDED_VERSION}",
        "tempo_bpm": tempo,
        "tempo_note": tempo_note,
        "loudness_lufs": loudness["lufs"],
        **loudness,
        "ending": "fade" if ending["type"] == "fade" else "cold",
        "ending_detail": ending,
        "sections": sections,
        "stereo": stereo,
        "spectral_centroid_hz": round(centroid),
        "rolloff95_hz": round(rolloff),
        "band_profile": _band_profile(power, side, sr),
        "fingerprint": {k: round(v, 2) for k, v in fingerprint.items()},
        "fingerprint_inputs": {
            "flatness": round(inputs["flatness"], 4),
            "contrast_db": round(inputs["contrast_db"], 1),
            "zcr_std": round(inputs["zcr_std"], 4),
            "perc_ratio": round(inputs["perc_ratio"], 3),
            "onsets_per_s": round(inputs["onsets_per_s"], 2),
        },
        "key": key,
        "time_signature": _time_signature(beat_strength),
        "valence": round(valence, 2),
        "arousal": round(arousal, 2),
        "mute_drops": drops,
        "chord_loop": _chord_loop(beat_chroma, key),
        "edit_points": _edit_points(sections, drops, ending, duration),
        "arrangement_notes": _arrangement_notes(sections, ending_start),
    })
    return _json_ready(result)


def measure_signal(y_stereo, sr, section_order=None, tempo_hint=None, audio_path=None):
    """Base measurement (song_moments.measure_song on the mono mix) plus the extended fields."""
    y = _as_stereo(y_stereo)
    base = measure_song(_base_mono(y, sr), SAMPLE_RATE, section_order)
    return measure_extended(y, sr, base, tempo_hint, audio_path)
