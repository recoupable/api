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
    _arrangement_notes,
    _base_mono,
    _edit_points,
    _ending_detail,
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
    drops = _find_drops(mono, SR, BPM, duration=30.0, ending_start=30.0, first_end=0.0)
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
    assert _find_drops(mono, SR, BPM, duration=30.0, ending_start=30.0, first_end=0.0) == []


def test_drops_inside_the_ending_are_ignored():
    mono = _click_track(30, GAP_START, GAP_BEATS)
    assert _find_drops(mono, SR, BPM, duration=30.0, ending_start=GAP_START - 1, first_end=0.0) == []


def test_a_drop_that_never_comes_back_is_the_ending_not_a_drop():
    mono = _click_track(30)
    mono[int(20 * SR):] = 0.0
    assert _find_drops(mono, SR, BPM, duration=30.0, ending_start=30.0, first_end=0.0) == []


def test_a_drop_that_only_comes_back_after_the_ending_starts_is_not_a_drop():
    mono = _click_track(30, GAP_START, GAP_BEATS)
    assert _find_drops(mono, SR, BPM, duration=30.0, ending_start=GAP_START + 0.5, first_end=0.0) == []


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
    fade = {"type": "fade", "from": 40.0, "silent_from": 46.0, "mmss": "0:40"}
    points = _edit_points(sections, drops, fade, 46.0)
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
    assert points[-1]["note"] == "Fades over 6 s; needs no tail edit."


@pytest.mark.parametrize(
    ("ending", "duration", "note"),
    [
        ({"type": "stop", "stop_at": 50.0, "silent_from": 50.0}, 56.0,
         "Cold stop; silence from 0:50. Trim the dead air."),
        ({"type": "stop", "stop_at": 50.0, "silent_from": 50.0}, 50.0, "Cold stop at the end of the file."),
        ({"type": "stop_with_tail", "stop_at": 50.0, "tail_until": 55.0}, 56.0,
         "Cold stop; a low tail runs to 0:55, then silence."),
    ],
)
def test_the_last_edit_point_is_where_the_band_stops(ending, duration, note):
    points = _edit_points([{"label": "verse", "start": 0.0}], [], {**ending, "mmss": "0:50"}, duration)
    assert (points[-1]["type"], points[-1]["time"], points[-1]["name"]) == ("out", 50.0, "Band stops")
    assert points[-1]["note"] == note


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
    for field in ("moments", "energy_curve", "duration_seconds", "names_from"):
        assert measured[field] == base[field]
    # sections only gain their arrangement
    assert [{k: v for k, v in s.items() if k != "arrangement"} for s in measured["sections"]] == base["sections"]
    assert measured["measured_with"] == base["measured_with"] + "+extended-2026-11-04.2"
    assert "lufs" not in base  # the base measurement is not changed in place
    assert all("arrangement" not in s for s in base["sections"])


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


# ---------------------------------------------------------------------------
# Arrangement density
# ---------------------------------------------------------------------------
BAND_SECTIONS = (("verse", 0.0, 10.0), ("bridge", 10.0, 20.0), ("chorus", 20.0, 30.0))
ARRANGEMENT_FIELDS = {"percussive_pct", "onsets_per_s", "high_pct", "sub_pct", "rms_db"}


def _band_song(drum_gain, tone_gain, drumless=(10.0, 20.0), seconds=30):
    """
    A 120 BPM band: a 60 Hz kick on every beat and a noise hat on every eighth over a
    sustained A major chord, with the drums muted from `drumless[0]` to `drumless[1]`.
    """
    t = np.arange(int(seconds * SR)) / SR
    tone = sum(np.sin(2 * np.pi * f * t) for f in A_MAJOR) / len(A_MAJOR)
    n = np.arange(int(0.12 * SR))
    kick = np.exp(-n / (0.03 * SR)) * np.sin(2 * np.pi * 60 * n / SR)
    hat = np.exp(-n / (0.005 * SR)) * np.random.default_rng(0).standard_normal(len(n))
    drums = np.zeros_like(t)
    for k, start in enumerate(np.arange(0, seconds, BEAT / 2)):
        i = int(start * SR)
        hit = hat if k % 2 else kick + 0.5 * hat
        drums[i:i + len(n)] += hit[: len(drums[i:i + len(n)])]
    drums[int(drumless[0] * SR):int(drumless[1] * SR)] = 0.0
    return (tone_gain * tone + drum_gain * drums).astype(np.float32)


def _measure_band(y):
    """measure_extended over BAND_SECTIONS, without the slower base pass."""
    base = {
        "measured_with": "test",
        "duration_seconds": len(y) / SR,
        "tempo_bpm": float(BPM),
        "loudness_lufs": None,
        "ending": "cold",
        "names_from": "lyrics",
        "sections": [
            {"label": label, "start": start, "end": end, "group": label[0].upper(), "energy": 50}
            for label, start, end in BAND_SECTIONS
        ],
        "moments": [],
        "energy_curve": [50] * int(len(y) / SR),
    }
    return measure_extended(np.vstack([y, y]), SR, base)


@pytest.fixture(scope="module")
def thinned():
    """Loud drums over a quiet chord; muting them in the bridge thins the band and drops the level."""
    return _measure_band(_band_song(drum_gain=0.8, tone_gain=0.05))


@pytest.fixture(scope="module")
def drumless():
    """Quiet drums under a loud sustained chord; without them the bridge holds its level."""
    return _measure_band(_band_song(drum_gain=0.1, tone_gain=0.5))


def test_a_bridge_without_its_drums_thins_the_band(thinned):
    perc = [s["arrangement"]["percussive_pct"] for s in thinned["sections"]]
    assert perc[1] < perc[0] and perc[1] < perc[2]
    assert "band thins at 0:10" in thinned["arrangement_notes"]
    assert "drums drop out at 0:10" not in thinned["arrangement_notes"]  # the level fell too far


def test_the_kick_and_hat_show_in_the_sub_and_high_shares(thinned):
    verse, bridge, chorus = (s["arrangement"] for s in thinned["sections"])
    assert bridge["sub_pct"] < min(verse["sub_pct"], chorus["sub_pct"])
    assert bridge["high_pct"] < min(verse["high_pct"], chorus["high_pct"])
    assert bridge["rms_db"] < min(verse["rms_db"], chorus["rms_db"]) - 6
    for section in (verse, chorus):
        assert 3 <= section["onsets_per_s"] <= 6  # eighth notes at 120 BPM; the long kick can count twice


def test_onsets_gone_under_a_held_chord_reads_as_the_drums_dropping_out(drumless):
    bridge = drumless["sections"][1]["arrangement"]
    assert bridge["onsets_per_s"] < 1
    assert "drums drop out at 0:10" in drumless["arrangement_notes"]
    assert "band thins at 0:10" not in drumless["arrangement_notes"]  # the more specific note stands alone


def test_arrangement_shares_lie_between_zero_and_one_hundred(measured, thinned, drumless):
    for song in (measured, thinned, drumless):
        assert song["sections"]
        assert all(isinstance(note, str) for note in song["arrangement_notes"])
        for section in song["sections"]:
            arrangement = section["arrangement"]
            assert set(arrangement) == ARRANGEMENT_FIELDS
            assert all(round(v, 1) == v for v in arrangement.values())
            for share in ("percussive_pct", "high_pct", "sub_pct"):
                assert 0 <= arrangement[share] <= 100
            assert arrangement["onsets_per_s"] >= 0
            assert arrangement["rms_db"] <= 0


def _sections(*rows):
    """Back-to-back sections with arrangement values: (start, percussive_pct, onsets_per_s, high_pct, rms_db)."""
    ends = [row[0] for row in rows[1:]] + [rows[-1][0] + 30.0]
    return [
        {"start": start, "end": end, "arrangement": {"percussive_pct": perc, "onsets_per_s": onsets,
                                                     "high_pct": high, "sub_pct": 10.0, "rms_db": rms}}
        for (start, perc, onsets, high, rms), end in zip(rows, ends)
    ]


def test_a_quiet_bright_first_section_is_a_sparse_open_and_not_a_thinning():
    sections = _sections(
        (0.0, 5.0, 0.5, 30.0, -30.0),   # quietest and brightest; would thin if it were not first
        (12.0, 40.0, 4.0, 20.0, -15.0),
        (40.0, 45.0, 5.0, 22.0, -12.0),
        (70.0, 42.0, 4.5, 21.0, -14.0),
    )
    assert _arrangement_notes(sections) == ["sparse open"]


def test_notes_follow_the_song_in_order():
    sections = _sections(
        (0.0, 40.0, 4.0, 20.0, -14.0),
        (30.0, 10.0, 1.5, 15.0, -20.0),   # thins: both more than 35 % under the median
        (60.0, 45.0, 5.0, 22.0, -12.0),
        (95.0, 20.0, 0.5, 18.0, -15.0),   # drums out: under one onset a second, level within 6 dB
        (120.0, 44.0, 4.5, 21.0, -13.0),
    )
    assert _arrangement_notes(sections) == ["band thins at 0:30", "drums drop out at 1:35"]


def test_a_single_section_has_no_notes():
    assert _arrangement_notes(_sections((0.0, 5.0, 0.5, 30.0, -30.0))) == []


def test_sections_inside_the_ending_get_no_notes():
    sections = _sections(
        (0.0, 40.0, 4.0, 20.0, -14.0),
        (30.0, 45.0, 5.0, 22.0, -12.0),
        (60.0, 42.0, 4.5, 21.0, -13.0),
        (90.0, 2.0, 0.0, 1.0, -40.0),   # after the band stops: the ending explains it
    )
    assert _arrangement_notes(sections) == ["band thins at 1:30"]
    assert _arrangement_notes(sections, ending_start=90.5) == []


# ---------------------------------------------------------------------------
# Ending
# ---------------------------------------------------------------------------
INTRO_SECONDS, BODY_SECONDS, END_SECONDS = 4, 30, 6


def _ending_song(ending):
    """
    Four quiet seconds (-60 dB), thirty of the click track, then six more: a fade
    (linear in dB down to -56 dB, running to the end of the file) or silence after a dead
    stop. The quiet intro anchors the energy curve's scale, as a real song's quietest
    seconds do, so the fade is not the quietest stretch of the song.
    """
    y = _click_track(INTRO_SECONDS + BODY_SECONDS + END_SECONDS).astype(np.float64)
    y[:INTRO_SECONDS * SR] *= 10 ** (-60 / 20)
    end = (INTRO_SECONDS + BODY_SECONDS) * SR
    if ending == "fade":
        y[end:] *= 10 ** (-56 * np.arange(len(y) - end) / (len(y) - end) / 20)
    else:
        y[end:] = 0.0
    return y.astype(np.float32)


def _measure_whole(y):
    stereo = np.vstack([y, y])
    return measure_extended(stereo, SR, measure_song(_base_mono(stereo, SR), SAMPLE_RATE))


@pytest.fixture(scope="module")
def stopped():
    return _measure_whole(_ending_song("stop"))


@pytest.fixture(scope="module")
def faded():
    return _measure_whole(_ending_song("fade"))


def test_a_dead_stop_reads_as_a_stop(stopped):
    stop = INTRO_SECONDS + BODY_SECONDS
    detail = stopped["ending_detail"]
    assert detail["type"] == "stop"
    # six seconds of digital silence flatten the energy curve's floor, so the
    # resampler's ringing can hold the stop's own second up: within a second
    assert stop <= detail["stop_at"] <= stop + 1
    assert detail["stop_at"] <= detail["silent_from"] < stopped["duration_seconds"]
    assert stopped["ending"] == "cold"
    last = stopped["edit_points"][-1]
    assert (last["type"], last["time"], last["name"]) == ("out", detail["stop_at"], "Band stops")
    assert last["note"].endswith("Trim the dead air.")
    assert all(d["start"] < stop for d in stopped["mute_drops"])  # the stop itself is not a breakdown


def test_a_six_second_ramp_reads_as_a_fade(faded):
    detail = faded["ending_detail"]
    assert detail["type"] == "fade"
    assert INTRO_SECONDS + BODY_SECONDS <= detail["from"] < detail["silent_from"] <= faded["duration_seconds"]
    assert detail["mmss"] == f"0:{int(detail['from'])}"
    assert faded["ending"] == "fade"
    last = faded["edit_points"][-1]
    assert (last["type"], last["time"], last["name"]) == ("out", detail["from"], "Fade begins")
    assert not any(d["start"] >= INTRO_SECONDS + BODY_SECONDS for d in faded["mute_drops"])  # the fade is no breakdown


def test_a_low_tail_after_a_stop_reads_as_a_stop_with_tail():
    curve = [100] * 20 + [20, 18, 15, 12, 0, 0]
    assert _ending_detail(curve, 26.0) == {
        "type": "stop_with_tail", "stop_at": 20.0, "tail_until": 24.0, "mmss": "0:20",
    }


def test_a_breath_of_silence_before_the_tail_is_still_a_stop_with_tail():
    curve = [100] * 20 + [0, 16, 12, 14, 14, 16, 10, 22, 22, 2, 0, 0]
    assert _ending_detail(curve, 32.0) == {
        "type": "stop_with_tail", "stop_at": 20.0, "tail_until": 29.0, "mmss": "0:20",
    }


def test_a_stop_with_a_short_tail_is_a_stop_not_a_fade():
    curve = [100] * 20 + [20, 15, 0, 0, 0]
    assert _ending_detail(curve, 25.0) == {"type": "stop", "stop_at": 20.0, "silent_from": 22.0, "mmss": "0:20"}


def test_a_gradual_decay_through_the_tail_band_is_still_a_fade():
    curve = [100] * 20 + [80, 60, 40, 25, 12, 5, 0]
    assert _ending_detail(curve, 27.0) == {"type": "fade", "from": 22.0, "silent_from": 25.0, "mmss": "0:22"}


def test_a_song_that_ends_at_full_level_stops_at_the_end_of_the_file():
    assert _ending_detail([100] * 30, 29.6) == {"type": "stop", "stop_at": 29.6, "silent_from": 29.6, "mmss": "0:29"}


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
