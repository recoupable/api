"""
serve_song_moments.py
---------------------
Modal app that measures a song's sections and best short moments from its
audio (see song_moments.py). CPU only: no model, no GPU. Backs
POST /api/songs/moments, which adds Music Flamingo descriptions per moment.

Usage:
  - Deploy:  GitHub Actions on push to main (.github/workflows/deploy-modal.yml)
  - Test locally:  modal run serve_song_moments.py --audio-url https://...
"""

from pathlib import Path

import modal

# ---------------------------------------------------------------------------
# Configuration — all tunables live here (no magic numbers inline)
# ---------------------------------------------------------------------------
CPU_CORES = 2.0
MEMORY_MB = 4096
SCALEDOWN_WINDOW = 60          # same idle window as music-flamingo
MAX_CONTAINERS = 8             # CPU containers are cheap; batches fan out
TIMEOUT_SECONDS = 300
DOWNLOAD_TIMEOUT_SECONDS = 60
MAX_AUDIO_BYTES = 100 * 1024 * 1024
MAX_AUDIO_SECONDS = 15 * 60    # decode at most the first 15 minutes
MAX_SECTION_LABELS = 60

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install(
        "librosa==0.10.2.post1",
        "pyloudnorm==0.1.1",
        "requests",
        "fastapi[standard]",
    )
    .add_local_file(Path(__file__).parent / "song_moments.py", "/root/song_moments.py")
)

app = modal.App(name="song-moments", image=image)


def _download(audio_url: str) -> str:
    """Stream the audio to a temp file, refusing anything over MAX_AUDIO_BYTES."""
    import os
    import tempfile
    from urllib.parse import urlparse

    import requests

    ext = os.path.splitext(urlparse(audio_url).path)[-1] or ".mp3"
    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    received = 0
    with requests.get(audio_url, stream=True, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
        response.raise_for_status()
        for chunk in response.iter_content(chunk_size=1 << 16):
            received += len(chunk)
            if received > MAX_AUDIO_BYTES:
                tmp.close()
                os.unlink(tmp.name)
                raise ValueError("audio file is larger than 100 MB")
            tmp.write(chunk)
    tmp.close()
    return tmp.name


@app.function(
    cpu=CPU_CORES,
    memory=MEMORY_MB,
    scaledown_window=SCALEDOWN_WINDOW,
    timeout=TIMEOUT_SECONDS,
    max_containers=MAX_CONTAINERS,
)
@modal.fastapi_endpoint(method="POST", docs=True, requires_proxy_auth=True)
def measure(request: dict):
    """
    Measure one song.

    JSON body:
    {
        "audio_url": "https://example.com/song.mp3",        (required)
        "section_order": ["verse", "chorus", "verse", ...]   (optional, lyric-sheet headers in order)
    }

    Returns sections, moments with :06/:15/:30 cuts, tempo, loudness, the
    ending type, a per-second energy curve and elapsed_seconds.
    """
    import os
    import time

    import librosa
    from fastapi import HTTPException

    from song_moments import SAMPLE_RATE, measure_song

    started = time.time()
    audio_url = request.get("audio_url")
    if not isinstance(audio_url, str) or not audio_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="audio_url must be an http(s) URL")
    section_order = request.get("section_order") or None
    if section_order is not None and (
        not isinstance(section_order, list)
        or len(section_order) > MAX_SECTION_LABELS
        or not all(isinstance(label, str) for label in section_order)
    ):
        raise HTTPException(status_code=422, detail="section_order must be a list of strings")

    try:
        path = _download(audio_url)
    except Exception as error:  # noqa: BLE001 - any fetch failure is the caller's URL
        raise HTTPException(status_code=422, detail=f"audio_url could not be downloaded: {error}") from error

    try:
        y, sr = librosa.load(path, sr=SAMPLE_RATE, mono=True, duration=MAX_AUDIO_SECONDS)
    except Exception as error:  # noqa: BLE001 - undecodable audio
        raise HTTPException(status_code=422, detail="audio_url is not decodable audio") from error
    finally:
        os.unlink(path)

    result = measure_song(y, sr, section_order)
    result["elapsed_seconds"] = round(time.time() - started, 2)
    return result


# ---------------------------------------------------------------------------
# Local test entrypoint — run with: modal run serve_song_moments.py --audio-url ...
# ---------------------------------------------------------------------------
@app.local_entrypoint()
def main(audio_url: str):
    """Measure one song on Modal and print the section map."""
    result = measure.remote({"audio_url": audio_url})
    for section in result["sections"]:
        print(f"{section['label']:<12} {section['start']:7.2f}-{section['end']:7.2f}")
    print(f"{len(result['moments'])} moments in {result['elapsed_seconds']}s")
