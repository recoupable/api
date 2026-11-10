"""
Tests for the pure helpers behind /generate_batch: prompt validation with
per-prompt clips and settings, and cutting clips from one download.

Needs `modal` importable (the module defines the Modal app) and ffmpeg:
  uv run --no-project --with modal --with pytest \
    python -I -m pytest modal/test_serve_music_flamingo.py -q
"""

import os
import subprocess

import pytest

from serve_music_flamingo import (
    MAX_BATCH_PROMPTS,
    check_generation_settings,
    cut_clip,
    extract_clip,
    is_number,
    parse_batch_prompts,
    run_batch,
)

DEFAULTS = {"temperature": 0.2, "top_p": 1.0, "do_sample": False}


def tone(path, seconds):
    """Write a sine tone of `seconds` to `path` with ffmpeg."""
    subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "lavfi",
         "-i", f"sine=frequency=440:duration={seconds}", path],
        check=True,
    )
    return path


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        check=True, capture_output=True, text=True,
    )
    return float(out.stdout.strip())


def test_prompts_take_the_batch_settings_when_they_set_none():
    jobs = parse_batch_prompts([{"id": "genre", "prompt": "Genre?"}], DEFAULTS)

    assert jobs == [{
        "id": "genre", "prompt": "Genre?", "max_new_tokens": 512, "clip": None,
        "temperature": 0.2, "top_p": 1.0, "do_sample": False,
    }]


def test_a_prompt_overrides_the_batch_settings_for_itself_only():
    jobs = parse_batch_prompts([
        {"id": "pitch", "prompt": "Pitch it.", "temperature": 0.6, "do_sample": True},
        {"id": "key", "prompt": "Key?"},
    ], DEFAULTS)

    assert (jobs[0]["temperature"], jobs[0]["top_p"], jobs[0]["do_sample"]) == (0.6, 1.0, True)
    assert (jobs[1]["temperature"], jobs[1]["do_sample"]) == (0.2, False)


def test_a_prompt_with_a_clip_window_carries_it_as_seconds():
    jobs = parse_batch_prompts(
        [{"id": "climax", "prompt": "Describe.", "clip_start": 36, "clip_end": 50.9}], DEFAULTS
    )

    assert jobs[0]["clip"] == (36.0, 50.9)


@pytest.mark.parametrize("window", [
    {"clip_start": 10},
    {"clip_end": 10},
    {"clip_start": 10, "clip_end": 10},
    {"clip_start": 12, "clip_end": 10},
    {"clip_start": -1, "clip_end": 10},
    {"clip_start": True, "clip_end": 10},
    {"clip_start": "0", "clip_end": 10},
])
def test_a_clip_needs_both_ends_in_order(window):
    with pytest.raises(ValueError, match=r"prompts\[0\] needs clip_start and clip_end"):
        parse_batch_prompts([{"id": "a", "prompt": "Describe.", **window}], DEFAULTS)


@pytest.mark.parametrize("item, message", [
    ({"id": "a", "prompt": "x", "temperature": "hot"}, r"prompts\[0\]\.temperature must be a number"),
    ({"id": "a", "prompt": "x", "top_p": True}, r"prompts\[0\]\.top_p must be a number"),
    ({"id": "a", "prompt": "x", "do_sample": 1}, r"prompts\[0\]\.do_sample must be a boolean"),
    ({"id": "a", "prompt": "x", "max_new_tokens": 0}, r"prompts\[0\]\.max_new_tokens must be 1-2048"),
    ({"id": "", "prompt": "x"}, r"prompts\[0\]\.id must be a non-empty string"),
    ({"id": "a", "prompt": ""}, r"prompts\[0\]\.prompt must be a non-empty string"),
])
def test_invalid_prompt_fields_are_named(item, message):
    with pytest.raises(ValueError, match=message):
        parse_batch_prompts([item], DEFAULTS)


def test_repeated_ids_and_list_bounds_are_refused():
    with pytest.raises(ValueError, match="is repeated"):
        parse_batch_prompts([{"id": "a", "prompt": "x"}, {"id": "a", "prompt": "y"}], DEFAULTS)
    with pytest.raises(ValueError, match="non-empty list"):
        parse_batch_prompts([], DEFAULTS)
    too_many = [{"id": str(i), "prompt": "x"} for i in range(MAX_BATCH_PROMPTS + 1)]
    with pytest.raises(ValueError, match="more than 40"):
        parse_batch_prompts(too_many, DEFAULTS)


def test_batch_level_settings_are_checked_without_a_prefix():
    check_generation_settings(DEFAULTS)
    with pytest.raises(ValueError, match="^temperature must be a number$"):
        check_generation_settings({**DEFAULTS, "temperature": None})


def test_extract_clip_cuts_the_window_and_keeps_the_source(tmp_path):
    source = tone(str(tmp_path / "song.wav"), 4)

    first = extract_clip(source, 0.5, 1.5)
    second = extract_clip(source, 2.0, 3.0)
    try:
        assert os.path.exists(source)
        assert first != second
        assert duration(first) == pytest.approx(1.0, abs=0.05)
        assert duration(second) == pytest.approx(1.0, abs=0.05)
    finally:
        os.unlink(first)
        os.unlink(second)


def test_cut_clip_replaces_the_source_with_the_clip(tmp_path):
    source = tone(str(tmp_path / "song.wav"), 4)

    clip = cut_clip(source, 1.0, 3.0)
    try:
        assert not os.path.exists(source)
        assert duration(clip) == pytest.approx(2.0, abs=0.05)
    finally:
        os.unlink(clip)


def test_extract_clip_refuses_a_backwards_window(tmp_path):
    source = tone(str(tmp_path / "song.wav"), 2)

    with pytest.raises(ValueError, match="before clip_end"):
        extract_clip(source, 1.5, 1.0)


@pytest.mark.parametrize("value, ok", [
    (3, True), (2.5, True), (0, True),
    (True, False), ("1", False), (None, False),
    (float("inf"), False), (float("nan"), False), (10 ** 400, False),
])
def test_is_number_takes_only_finite_numbers(value, ok):
    assert is_number(value) is ok


def test_a_clip_window_at_infinity_or_too_large_for_a_float_is_refused():
    for end in (float("inf"), 10 ** 400):
        with pytest.raises(ValueError, match="needs clip_start and clip_end"):
            parse_batch_prompts([{"id": "a", "prompt": "x", "clip_start": 0, "clip_end": end}], DEFAULTS)
    with pytest.raises(ValueError, match="temperature must be a number"):
        parse_batch_prompts([{"id": "a", "prompt": "x", "temperature": float("nan")}], DEFAULTS)


class FakeModel:
    """Stands in for the GPU: records each call and what audio it was given."""

    def __init__(self, fail_on=None):
        self.calls = []
        self.fail_on = fail_on

    def __call__(self, prompt, audio_path, max_new_tokens, temperature, top_p, do_sample):
        self.calls.append({
            "prompt": prompt, "audio_path": audio_path, "existed": os.path.exists(audio_path),
            "seconds": duration(audio_path), "max_new_tokens": max_new_tokens,
            "temperature": temperature, "top_p": top_p, "do_sample": do_sample,
        })
        if prompt == self.fail_on:
            raise RuntimeError("model failed")
        return f"answer to {prompt}"


def test_run_batch_answers_in_order_with_each_prompts_own_settings_and_clip(tmp_path):
    source = tone(str(tmp_path / "song.wav"), 4)
    jobs = parse_batch_prompts([
        {"id": "whole", "prompt": "Genre?"},
        {"id": "hook", "prompt": "Describe.", "clip_start": 1, "clip_end": 2.5,
         "temperature": 0.7, "do_sample": True},
    ], DEFAULTS)
    model = FakeModel()

    answers = run_batch(jobs, source, model)

    assert [a["id"] for a in answers] == ["whole", "hook"]
    assert answers[0]["response"] == "answer to Genre?"
    assert "clip_start" not in answers[0]
    assert (answers[1]["clip_start"], answers[1]["clip_end"]) == (1.0, 2.5)
    whole, hook = model.calls
    assert whole["audio_path"] == source and whole["seconds"] == pytest.approx(4, abs=0.05)
    assert (whole["temperature"], whole["do_sample"]) == (0.2, False)
    assert hook["audio_path"] != source and hook["existed"]
    assert hook["seconds"] == pytest.approx(1.5, abs=0.05)
    assert (hook["temperature"], hook["top_p"], hook["do_sample"]) == (0.7, 1.0, True)
    assert not os.path.exists(hook["audio_path"])
    assert os.path.exists(source)


def test_run_batch_deletes_the_clip_when_the_model_fails(tmp_path):
    source = tone(str(tmp_path / "song.wav"), 3)
    jobs = parse_batch_prompts(
        [{"id": "hook", "prompt": "Describe.", "clip_start": 0.5, "clip_end": 1.5}], DEFAULTS
    )
    model = FakeModel(fail_on="Describe.")

    with pytest.raises(RuntimeError, match="model failed"):
        run_batch(jobs, source, model)

    assert not os.path.exists(model.calls[0]["audio_path"])
    assert os.path.exists(source)
