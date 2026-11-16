"""
Tests for song_moments.py on a synthetic song with known section times.

Run:
  uv run --no-project --with librosa==0.10.2.post1 --with pyloudnorm==0.1.1 --with pytest \
    python -I -m pytest modal/test_song_moments.py -q
"""

import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from song_moments import SAMPLE_RATE, _cuts, measure_song, normalize_label  # noqa: E402

BPM = 120
CHORDS = {"verse": (261.6, 329.6, 392.0), "chorus": (220.0, 261.6, 329.6, 440.0), "intro": (196.0, 293.7)}


def _section(kind, seconds, gain):
    t = np.arange(int(seconds * SAMPLE_RATE)) / SAMPLE_RATE
    tone = sum(np.sin(2 * np.pi * f * t) for f in CHORDS[kind]) / len(CHORDS[kind])
    if kind == "chorus":
        tone = tone + 0.3 * np.random.default_rng(0).standard_normal(len(t))  # a denser, brighter mix
    beat = np.zeros_like(t)
    for start in np.arange(0, seconds, 60 / BPM):
        i = int(start * SAMPLE_RATE)
        click = np.exp(-np.arange(800) / 120) * np.sin(2 * np.pi * 1000 * np.arange(800) / SAMPLE_RATE)
        beat[i:i + 800] += click[: len(beat[i:i + 800])]
    return gain * (0.6 * tone + 0.8 * beat)


@pytest.fixture(scope="module")
def song():
    parts = [("intro", 8, 0.1), ("verse", 16, 0.25), ("chorus", 16, 0.8), ("verse", 16, 0.25), ("chorus", 16, 0.8)]
    y = np.concatenate([_section(kind, seconds, gain) for kind, seconds, gain in parts])
    fade = _section("chorus", 8, 0.8) * np.linspace(1, 0.001, 8 * SAMPLE_RATE)
    return np.concatenate([y, fade]).astype(np.float32)


def test_normalize_label_maps_lyric_sheet_headers():
    assert normalize_label("Verse 2") == "verse"
    assert normalize_label("Pre-Chorus") == "pre-chorus"
    assert normalize_label("Post-Chorus: Anne-Marie") == "post-chorus"
    assert normalize_label("Hook") == "chorus"
    assert normalize_label("Spoken word") is None


def test_cuts_start_on_the_beat_and_fit_the_length():
    times = np.arange(0, 60, 0.5)
    cuts = _cuts(times, 10.0, 25.0, 60.0)
    assert cuts["6"] == [10.0, 16.0]
    assert cuts["15"] == [10.0, 25.0]
    assert cuts["30"] == [10.0, 40.0]
    assert _cuts(times, 50.0, 60.0, 60.0, anchor="end")["6"] == [54.0, 60.0]


def test_sections_named_from_the_lyric_sheet_land_on_the_audio(song):
    result = measure_song(song, SAMPLE_RATE, ["Verse 1", "Chorus", "Verse 2", "Chorus"])
    assert result["names_from"] == "lyrics"
    choruses = [s for s in result["sections"] if s["label"] == "chorus"]
    assert len(choruses) == 2
    assert abs(choruses[0]["start"] - 24) <= 2
    assert abs(choruses[1]["start"] - 56) <= 2
    assert choruses[0]["group"] == choruses[1]["group"]


def test_moments_find_the_hook_climax_and_fade(song):
    result = measure_song(song, SAMPLE_RATE, ["Verse 1", "Chorus", "Verse 2", "Chorus"])
    moments = {m["type"]: m for m in result["moments"]}
    assert abs(moments["vocal_hook"]["start"] - 24) <= 2
    climax = next(m for m in result["moments"] if "climax" in [m["type"], *m.get("also", [])])
    assert climax["section"] == "chorus"
    assert result["ending"] == "fade"
    assert all(m["cuts"]["6"][1] - m["cuts"]["6"][0] <= 6.25 for m in result["moments"])


def test_without_a_sheet_the_loud_repeat_is_called_the_chorus(song):
    result = measure_song(song, SAMPLE_RATE)
    assert result["names_from"] == "audio"
    chorus_starts = [s["start"] for s in result["sections"] if s["label"] == "chorus"]
    assert any(abs(start - 24) <= 2 for start in chorus_starts)
