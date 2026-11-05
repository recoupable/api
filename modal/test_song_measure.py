"""
Tests for song_measure.py on synthetic signals with known answers.

Run:
  uv run --no-project --with librosa==0.10.2.post1 --with pyloudnorm==0.1.1 --with pytest \
    python -I -m pytest modal/test_song_measure.py -q
"""

import json
import os
import shutil
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from song_measure import (  # noqa: E402
    EXTENDED_SAMPLE_RATE,
    _base_mono,
    _edit_points,
    _find_drops,
    _parse_ebur128,
    _reconcile_tempo,
    measure_extended,
)
from song_moments import SAMPLE_RATE, measure_file, measure_song  # noqa: E402

SR = EXTENDED_SAMPLE_RATE
BPM = 120
BEAT = 60 / BPM
GAP_START, GAP_BEATS = 16.0, 2   # a silent two-beat gap: the band stops dead
SECONDS = 40
A_MAJOR = (220.0, 277.18, 329.63, 440.0)  # A, C#, E, A


def _click_track(seconds, gap_start=None, gap_beats=0):
    """A 120 BPM click over a sustained A major chord, silent for `gap_beats` from `gap_start`."""
    t = np.arange(int(seconds * SR)) / SR
    tone = sum(np.sin(2 * np.pi * f * t) for f in A_MAJOR) / len(A_MAJOR)
    clicks = np.zeros_like(t)
    click = np.exp(-np.arange(1600) / 240) * np.sin(2 * np.pi * 1000 * np.arange(1600) / SR)
    for start in np.arange(0, seconds, BEAT):
        i = int(start * SR)
        clicks[i:i + 1600] += click[: len(clicks[i:i + 1600])]
    y = 0.3 * tone + 0.5 * clicks
    if gap_start is not None:
        y[int(gap_start * SR):int((gap_start + gap_beats * BEAT) * SR)] = 0.0
    return y.astype(np.float32)


@pytest.fixture(scope="module")
def stereo():
    mono = _click_track(SECONDS, GAP_START, GAP_BEATS)
    return np.vstack([mono, 0.8 * mono])  # a little wider on the left


@pytest.fixture(scope="module")
def base(stereo):
    return measure_song(_base_mono(stereo, SR), SAMPLE_RATE)


@pytest.fixture(scope="module")
def measured(stereo, base):
    return measure_extended(stereo, SR, base)


# ---------------------------------------------------------------------------
# Tempo
# ---------------------------------------------------------------------------
def test_tempo_reconciliation_picks_three_quarters_of_the_tracker_read():
    tempo, note = _reconcile_tempo(117.5, 86)
    assert tempo == 88.1
    assert note == "beat tracker 117.5 reconciled to hint 86"


def test_tempo_without_a_hint_is_the_tracker_read():
    assert _reconcile_tempo(117.5, None) == (117.5, "beat tracker")


def test_tempo_hint_wins_when_no_ratio_lands_near_it():
    tempo, note = _reconcile_tempo(100.0, 115.0)
    assert tempo == 115.0
    assert note == "hint 115; beat tracker 100 disagreed"


# ---------------------------------------------------------------------------
# Drops
# ---------------------------------------------------------------------------
def test_a_silent_two_beat_gap_is_found_at_the_right_time():
    mono = _click_track(30, GAP_START, GAP_BEATS)
    drops = _find_drops(mono, SR, BPM, duration=30.0, fade_start=30.0, first_end=0.0)
    assert len(drops) == 1
    drop = drops[0]
    assert drop["type"] in ("mute", "breakdown")
    assert abs(drop["start"] - GAP_START) <= 0.15
    assert abs(drop["end"] - (GAP_START + GAP_BEATS * BEAT)) <= 0.15
    assert 1.5 <= drop["beats"] <= 2.5
    assert drop["depth_db"] > 20
    assert drop["mmss"] == "0:16"


def test_a_steady_click_track_has_no_drops():
    mono = _click_track(30)
    assert _find_drops(mono, SR, BPM, duration=30.0, fade_start=30.0, first_end=0.0) == []


def test_drops_inside_the_fade_are_ignored():
    mono = _click_track(30, GAP_START, GAP_BEATS)
    assert _find_drops(mono, SR, BPM, duration=30.0, fade_start=GAP_START - 1, first_end=0.0) == []


# ---------------------------------------------------------------------------
# Edit points
# ---------------------------------------------------------------------------
def test_edit_points_mark_chorus_entries_breakdowns_and_the_fade():
    sections = [
        {"label": "intro", "start": 0.0},
        {"label": "verse", "start": 8.0},
        {"label": "chorus", "start": 24.0},
        {"label": "outro", "start": 40.0},
    ]
    drops = [
        {"type": "mute", "start": 12.0, "end": 12.5, "beats": 1.0, "depth_db": 20.0},
        {"type": "breakdown", "start": 30.0, "end": 34.0, "beats": 8.0, "depth_db": 15.0},
    ]
    points = _edit_points(sections, drops, "fade")
    assert [(p["type"], p["time"], p["name"]) for p in points] == [
        ("in", 0.0, "Cold open (intro)"),
        ("out", 12.0, "Mute drop"),
        ("in", 24.0, "Chorus drop"),
        ("out", 30.0, "Breakdown"),
        ("in", 34.0, "Re-entry after the breakdown"),
        ("out", 40.0, "Chorus cut point"),
        ("out", 40.0, "Fade begins"),
    ]
    assert points[2]["mmss"] == "0:24"


# ---------------------------------------------------------------------------
# Loudness
# ---------------------------------------------------------------------------
EBUR128_SUMMARY = """
[Parsed_ebur128_0 @ 0x1] t: 3.0  TARGET:-23 LUFS    M: -10.2 S: -10.5     I: -10.4 LUFS       LRA:   0.0 LU
[Parsed_ebur128_0 @ 0x1] Summary:

  Integrated loudness:
    I:          -9.8 LUFS
    Threshold: -19.9 LUFS

  Loudness range:
    LRA:         6.2 LU
    Threshold: -29.9 LUFS
    LRA low:   -14.1 LUFS
    LRA high:   -7.9 LUFS

  True peak:
    Peak:        0.4 dBFS
"""


def test_ebur128_summary_is_parsed():
    assert _parse_ebur128(EBUR128_SUMMARY) == {"lufs": -9.8, "lra": 6.2, "true_peak": 0.4}


def test_ebur128_ignores_an_unmeasurable_value():
    assert _parse_ebur128("    I:         -inf LUFS\n    Peak:       -inf dBFS\n") == {}


# ---------------------------------------------------------------------------
# The whole measurement
# ---------------------------------------------------------------------------
def test_the_base_measurement_stays_at_the_top_level(measured, base):
    for field in ("sections", "moments", "energy_curve", "ending", "duration_seconds", "names_from"):
        assert measured[field] == base[field]
    assert measured["measured_with"] == base["measured_with"] + "+extended-2026-11-04"
    assert "lufs" not in base  # the base measurement is not changed in place


def test_one_loudness_figure(measured):
    assert measured["lufs"] == measured["loudness_lufs"]


def test_a_tone_in_a_known_key_yields_its_tonic(measured):
    assert measured["key"]["tonic"] == "A"
    assert measured["key"]["mode"] in ("major", "minor")
    assert -1 <= measured["key"]["confidence"] <= 1


def test_fingerprint_values_stay_between_zero_and_one(measured):
    assert set(measured["fingerprint"]) == {
        "organic_electronic",
        "sparse_dense",
        "dark_bright",
        "intimate_anthemic",
        "smooth_textured",
        "slow_fast",
    }
    assert all(0.0 <= v <= 1.0 for v in measured["fingerprint"].values())
    assert set(measured["fingerprint_inputs"]) == {"flatness", "contrast_db", "zcr_std", "perc_ratio", "onsets_per_s"}


def test_band_shares_sum_to_about_one_hundred(measured):
    bands = measured["band_profile"]
    assert [b["band"] for b in bands] == ["sub", "low", "low_mid", "mid", "high_mid", "high", "air"]
    assert abs(sum(b["share_pct"] for b in bands) - 100) <= 1.0
    assert all(0 <= b["level_pct"] <= 100 and b["status"] in ("clear", "heavy", "light") for b in bands)


def test_the_gap_shows_up_in_the_full_measurement(measured):
    assert any(abs(d["start"] - GAP_START) <= 0.15 for d in measured["mute_drops"])


def test_stereo_and_mood_fields_are_in_range(measured):
    assert measured["stereo"]["lr_correlation"] == pytest.approx(1.0, abs=0.01)
    assert 0 < measured["stereo"]["side_to_mid"] < 0.2
    assert 0 <= measured["valence"] <= 1 and 0 <= measured["arousal"] <= 1
    assert measured["time_signature"] in ("3/4", "4/4")
    assert measured["chord_loop"]["confidence"] == "low"


def test_without_a_file_true_peak_is_skipped(measured):
    assert measured["true_peak_dbtp"] is None
    assert measured["loudness_range_lu"] is None
    assert measured["broadcast_ready"] is None
    assert isinstance(measured["sample_peak_dbfs"], float)


def test_the_measurement_is_strict_json(measured):
    json.dumps(measured, allow_nan=False)


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_measure_file_reads_true_peak_and_reconciles_a_tempo_hint(stereo, tmp_path):
    import soundfile

    path = tmp_path / "song.wav"
    soundfile.write(path, stereo.T, SR)
    result = measure_file(str(path), tempo_hint=60)
    assert isinstance(result["true_peak_dbtp"], float)
    assert result["true_peak_dbtp"] >= result["sample_peak_dbfs"] - 0.5
    assert isinstance(result["loudness_range_lu"], float)
    assert isinstance(result["broadcast_ready"], bool)
    assert result["loudness_lufs"] == result["lufs"]
    assert result["tempo_bpm"] == pytest.approx(60, abs=1.5)
    assert "reconciled to hint 60" in result["tempo_note"]
    # drops are framed on 1/8 beats, so at ~60 BPM the start lands within a quarter beat
    assert any(abs(d["start"] - GAP_START) <= 0.25 for d in result["mute_drops"])
    json.dumps(result, allow_nan=False)
