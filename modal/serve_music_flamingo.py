"""
serve_music_flamingo.py
-----------------------
Modal app that hosts NVIDIA's Music Flamingo model as a serverless API endpoint.

Music Flamingo is an 8B-parameter Audio Language Model for music understanding.
It can answer questions about music, describe tracks, transcribe lyrics, and more.

OPTIMIZATION: Model weights are downloaded at IMAGE BUILD TIME (not runtime).
This means cold starts only need to load weights from disk → GPU (~30-60s),
instead of downloading 16GB from the internet (~3-5 min).

Usage:
  - Deploy:  modal deploy serve_music_flamingo.py
  - Test locally:  modal run serve_music_flamingo.py
"""

import modal

# ---------------------------------------------------------------------------
# Configuration — all tunables live here (no magic numbers inline)
# ---------------------------------------------------------------------------
MODEL_ID = "nvidia/music-flamingo-2601-hf"
GPU_TYPE = "A100"              # A100 40GB — enough VRAM for the 8B model in BF16
SCALEDOWN_WINDOW = 60    # 1 min idle before a container stops. Modal bills the whole
                         # window per container; 300 s cost ~5x the inference time on
                         # bursty traffic (recoupable/app#2061, measured 2026-09-06).
# Workspace GPU cap is 10; keep this at 4 so a runaway queue cannot
# burn the $100 Modal usage limit (~$8.64/hour vs ~$21.60 at 10 GPUs).
MAX_CONTAINERS = 4
MAX_NEW_TOKENS = 512           # default max tokens to generate
MAX_NEW_TOKENS_LIMIT = 2048    # hard cap per prompt on /generate_batch
MAX_BATCH_PROMPTS = 40         # most prompts one /generate_batch request may carry
MODEL_CACHE_DIR = "/model_cache"  # where model weights live inside the container
AUDIO_DOWNLOAD_TIMEOUT = 120   # seconds; an unreachable host must not hold a GPU
# Formats the processor's audio loader reads directly. Anything else is
# transcoded to WAV with ffmpeg (which the image installs) before inference.
DECODABLE_EXTENSIONS = {".wav", ".mp3", ".flac"}


def transcode_to_wav(path: str) -> str:
    """
    Converts a downloaded audio file to 16 kHz mono WAV next to it and removes
    the original. Raises if ffmpeg cannot read the file.

    Music Flamingo's feature extractor resamples to 16 kHz mono anyway, so the
    conversion loses nothing the model would have used.
    """
    import os
    import subprocess

    out_path = path + ".wav"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", "16000", out_path],
        check=True,
        capture_output=True,
        text=True,
    )
    os.unlink(path)
    return out_path


# ---------------------------------------------------------------------------
# Helper: download model at image build time
# ---------------------------------------------------------------------------
def download_model_weights():
    """
    Downloads model weights from Hugging Face and saves them inside the image.
    This function runs ONCE during `modal deploy` (image build), not at runtime.
    The weights become part of the container image, so every cold start
    finds them already on disk — no internet download needed.
    """
    import os
    from huggingface_hub import snapshot_download

    os.makedirs(MODEL_CACHE_DIR, exist_ok=True)

    # snapshot_download grabs all the files for the model in one efficient call
    snapshot_download(
        repo_id=MODEL_ID,
        local_dir=os.path.join(MODEL_CACHE_DIR, "model"),
    )

    print(f"Model weights saved to {MODEL_CACHE_DIR}/model")


def extract_clip(path, start, end):
    """
    Cut start..end seconds of `path` into a new 16 kHz mono WAV and return its
    path. The source is kept, so a batch can cut several clips from one
    download; the caller deletes the clip.
    """
    import os
    import subprocess
    import tempfile

    if not 0 <= start < end:
        raise ValueError("clip_start must be at least 0 and before clip_end")
    clip = tempfile.NamedTemporaryFile(suffix="-clip.wav", delete=False)
    clip.close()
    try:
        subprocess.run(
            ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-ss", str(start), "-t", str(end - start),
             "-i", path, "-ac", "1", "-ar", "16000", clip.name],
            check=True,
            timeout=60,
        )
    except Exception:
        os.unlink(clip.name)
        raise
    return clip.name


def cut_clip(path, start, end):
    """
    Replace the downloaded file with just start..end seconds of it, so the
    model describes one moment rather than the whole song. Returns the clip's
    path; the original is removed.
    """
    import os

    clip_path = extract_clip(path, start, end)
    os.unlink(path)
    return clip_path


def is_number(value) -> bool:
    """
    A finite JSON number: int or float, but not bool (bool is an int subclass
    in Python), NaN, infinity, or an int too large to be a float.
    """
    import math

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(float(value))
    except OverflowError:
        return False


def check_generation_settings(settings: dict, where: str = "") -> None:
    """
    Raises ValueError unless `temperature` and `top_p` (when present) are
    numbers and `do_sample` (when present) is a boolean. `where` prefixes the
    message, e.g. "prompts[2]." for one prompt's own settings.
    """
    for key in ("temperature", "top_p"):
        if key in settings and not is_number(settings[key]):
            raise ValueError(f"{where}{key} must be a number")
    if "do_sample" in settings and not isinstance(settings["do_sample"], bool):
        raise ValueError(f"{where}do_sample must be a boolean")


def parse_batch_prompts(prompts, defaults: dict) -> list:
    """
    Validates /generate_batch's `prompts` and resolves each one into a job.

    A prompt may carry `clip_start` and `clip_end` (seconds, both or neither)
    to be answered from just that stretch of the audio, and `temperature`,
    `top_p` or `do_sample` to override the batch's `defaults` for that prompt
    alone. Returns one job dict per prompt, in order; raises ValueError naming
    the first invalid field.
    """
    if not isinstance(prompts, list) or not prompts:
        raise ValueError("prompts must be a non-empty list")
    if len(prompts) > MAX_BATCH_PROMPTS:
        raise ValueError(f"prompts cannot contain more than {MAX_BATCH_PROMPTS} items")

    jobs = []
    seen_ids = set()
    for index, item in enumerate(prompts):
        if not isinstance(item, dict):
            raise ValueError(f"prompts[{index}] must be an object")
        prompt_id = item.get("id")
        prompt = item.get("prompt")
        max_tokens = item.get("max_new_tokens", MAX_NEW_TOKENS)
        if not isinstance(prompt_id, str) or not prompt_id:
            raise ValueError(f"prompts[{index}].id must be a non-empty string")
        if prompt_id in seen_ids:
            raise ValueError(f"prompts[{index}].id '{prompt_id}' is repeated")
        seen_ids.add(prompt_id)
        if not isinstance(prompt, str) or not prompt:
            raise ValueError(f"prompts[{index}].prompt must be a non-empty string")
        # bool is an int subclass in Python; refuse it explicitly
        if (
            isinstance(max_tokens, bool)
            or not isinstance(max_tokens, int)
            or not 1 <= max_tokens <= MAX_NEW_TOKENS_LIMIT
        ):
            raise ValueError(f"prompts[{index}].max_new_tokens must be 1-{MAX_NEW_TOKENS_LIMIT}")
        check_generation_settings(item, f"prompts[{index}].")

        clip = None
        clip_start, clip_end = item.get("clip_start"), item.get("clip_end")
        if clip_start is not None or clip_end is not None:
            if not (is_number(clip_start) and is_number(clip_end) and 0 <= clip_start < clip_end):
                raise ValueError(
                    f"prompts[{index}] needs clip_start and clip_end in seconds, "
                    "with 0 <= clip_start < clip_end"
                )
            clip = (float(clip_start), float(clip_end))

        jobs.append({
            "id": prompt_id,
            "prompt": prompt,
            "max_new_tokens": max_tokens,
            "clip": clip,
            "temperature": item.get("temperature", defaults["temperature"]),
            "top_p": item.get("top_p", defaults["top_p"]),
            "do_sample": item.get("do_sample", defaults["do_sample"]),
        })
    return jobs


def run_batch(jobs: list, audio_path: str, run_prompt) -> list:
    """
    Answers each job (from parse_batch_prompts) against `audio_path`, or
    against a clip cut from it when the job has one; every clip is deleted
    after its prompt, whether or not the prompt succeeds. `run_prompt(prompt,
    audio_path, max_new_tokens, temperature, top_p, do_sample)` returns the
    answer text. Returns the answers in job order; an answer from a clip
    echoes the window so the caller can tell it came from the clip.
    """
    import os
    import time

    answers = []
    for job in jobs:
        started = time.time()
        clip_path = extract_clip(audio_path, *job["clip"]) if job["clip"] else None
        try:
            response = run_prompt(
                job["prompt"], clip_path or audio_path, job["max_new_tokens"],
                job["temperature"], job["top_p"], job["do_sample"],
            )
        finally:
            if clip_path:
                os.unlink(clip_path)
        answer = {
            "id": job["id"],
            "response": response,
            "elapsed_seconds": round(time.time() - started, 2),
        }
        if job["clip"]:
            answer["clip_start"], answer["clip_end"] = job["clip"]
        answers.append(answer)
    return answers


# ---------------------------------------------------------------------------
# Modal Image — the "Docker image" that runs on the cloud GPU.
# Key optimization: .run_function(download_model_weights) bakes the 16GB
# model weights directly into the image so they're pre-loaded on disk.
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.11")
    # System libraries for audio processing
    .apt_install("ffmpeg", "libsndfile1")
    # Python dependencies: PyTorch, audio tools, web framework
    .pip_install(
        "torch>=2.1.0",
        "torchaudio",
        "accelerate",
        "soundfile",
        "librosa",
        "requests",
        "fastapi[standard]",
        "huggingface_hub",
        # Music Flamingo is upstream since transformers 5.6.0
        # (huggingface/transformers#43538); pinned for reproducible builds.
        "transformers==5.16.1",
    )
    # Download model weights at build time (the big optimization!)
    .run_function(download_model_weights)
)

# ---------------------------------------------------------------------------
# Modal App
# ---------------------------------------------------------------------------
app = modal.App(name="music-flamingo", image=image)


@app.cls(
    gpu=GPU_TYPE,
    scaledown_window=SCALEDOWN_WINDOW,
    timeout=600,
    max_containers=MAX_CONTAINERS,
)
class MusicFlamingo:
    """
    Serves the Music Flamingo model as an API.
    The model loads from pre-cached weights on disk (baked into the image),
    so cold starts are fast — just disk → GPU, no internet needed.
    """

    @modal.enter()
    def load_model(self):
        """
        Called once when the container starts. Loads weights from the
        pre-cached files on disk into GPU memory. This is fast because
        the weights are already inside the container image.
        """
        import torch
        from transformers import MusicFlamingoForConditionalGeneration, AutoProcessor
        import os

        model_path = os.path.join(MODEL_CACHE_DIR, "model")
        print(f"Loading model from {model_path}...")

        # Load the processor (tokenizer + audio feature extractor)
        self.processor = AutoProcessor.from_pretrained(model_path)

        # Load the model with all optimizations:
        #   - sdpa: PyTorch Scaled Dot-Product Attention -- faster than vanilla
        #     attention, built into PyTorch (no extra packages needed).
        #     See: https://huggingface.co/nvidia/music-flamingo-2601-hf
        #   - torch.bfloat16: half-precision to reduce VRAM usage
        #   - low_cpu_mem_usage: loads weights shard-by-shard to reduce peak RAM
        self.model = MusicFlamingoForConditionalGeneration.from_pretrained(
            model_path,
            device_map="auto",
            dtype=torch.bfloat16,
            attn_implementation="sdpa",
            low_cpu_mem_usage=True,
        )

        print("Model loaded with SDPA attention!")

    @modal.fastapi_endpoint(method="GET", docs=True, requires_proxy_auth=True)
    def health(self):
        """
        Quick health check — returns instantly if the container is alive
        and the model is loaded. Useful for monitoring or pre-warming.

        GET /health → {"status": "ok", "model": "nvidia/music-flamingo-2601-hf"}
        """
        return {"status": "ok", "model": MODEL_ID}

    def download_audio(self, audio_url: str) -> str:
        """
        Downloads `audio_url` to a temp file and, when the processor cannot
        read its format, transcodes it to WAV. Returns the local path; the
        caller deletes it. Shared by /generate and /generate_batch so a batch
        downloads (and transcodes) its audio exactly once.

        Raises HTTPException 422 when the URL cannot be fetched
        (audio_unreachable) or ffmpeg cannot read the file (audio_undecodable).
        """
        import requests as http_requests
        import tempfile
        import os
        from urllib.parse import urlparse
        from fastapi import HTTPException

        try:
            audio_response = http_requests.get(audio_url, timeout=AUDIO_DOWNLOAD_TIMEOUT)
            audio_response.raise_for_status()
        except http_requests.RequestException as err:
            raise HTTPException(status_code=422, detail=f"audio_unreachable: {err}")

        # Strip query params before extracting extension — signed URLs
        # (CloudFront, S3, Supabase Storage) append ?Expires=...&Signature=...
        # which os.path.splitext would include in the "extension", creating
        # filenames that exceed the OS 255-char limit.
        url_path = urlparse(audio_url).path
        ext = os.path.splitext(url_path)[-1].lower() or ".mp3"
        tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
        tmp.write(audio_response.content)
        tmp.flush()
        tmp_path = tmp.name
        tmp.close()

        # The processor's loader reads WAV, MP3 and FLAC. Anything else
        # (M4A/AAC, OGG, WebM, MP4 audio) goes through ffmpeg first.
        if ext not in DECODABLE_EXTENSIONS:
            try:
                tmp_path = transcode_to_wav(tmp_path)
            except Exception as err:
                os.unlink(tmp_path)
                raise HTTPException(status_code=422, detail=f"audio_undecodable: {err}")

        return tmp_path

    def run_prompt(self, prompt, audio_path, max_tokens, temperature, top_p, do_sample) -> str:
        """
        Runs one prompt as its own conversation on the loaded model, with the
        audio at `audio_path` attached when given, and returns the decoded
        answer. Shared by /generate and /generate_batch.
        """
        # ---- Build the conversation ----
        # Music Flamingo uses a chat-style format with "user" and "assistant" roles
        content = [{"type": "text", "text": prompt}]
        if audio_path:
            content.append({"type": "audio", "path": audio_path})
        conversation = [{"role": "user", "content": content}]

        # ---- Run inference ----
        inputs = self.processor.apply_chat_template(
            conversation,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
        ).to(self.model.device)

        # Cast audio features to the model's dtype if present
        if "input_features" in inputs:
            inputs["input_features"] = inputs["input_features"].to(self.model.dtype)

        # Pass generation parameters to control output style
        outputs = self.model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            do_sample=do_sample,
        )

        # Decode only the NEW tokens (skip the input prompt tokens)
        decoded = self.processor.batch_decode(
            outputs[:, inputs.input_ids.shape[1]:],
            skip_special_tokens=True,
        )
        return decoded[0]

    @modal.fastapi_endpoint(method="POST", docs=True, requires_proxy_auth=True)
    def generate(self, request: dict):
        """
        Main API endpoint for music understanding.

        JSON body:
        {
            "prompt": "Describe this track.",          (required)
            "audio_url": "https://example.com/s.mp3",  (optional)
            "max_new_tokens": 512,                     (optional, default 512)
            "temperature": 0.7,                        (optional, default 1.0)
            "top_p": 0.9,                              (optional, default 1.0)
            "do_sample": false,                        (optional, default false)
            "clip_start": 45.2,                        (optional, seconds; with clip_end,
            "clip_end": 60.4                            the model hears only that clip)
        }

        Returns:
        {
            "response": "...",
            "elapsed_seconds": 3.21
        }
        """
        import os
        import time

        start_time = time.time()

        # ---- Parse input ----
        prompt = request.get("prompt", "Describe this music.")
        audio_url = request.get("audio_url", None)
        max_tokens = request.get("max_new_tokens", MAX_NEW_TOKENS)

        # Generation parameters -- control how "creative" the output is:
        # temperature: higher = more creative/random, lower = more focused/deterministic
        # top_p: nucleus sampling -- only consider tokens within this probability mass
        # do_sample: if False, always picks the most likely token (greedy decoding)
        temperature = request.get("temperature", 1.0)
        top_p = request.get("top_p", 1.0)
        do_sample = request.get("do_sample", False)
        clip_start = request.get("clip_start", None)
        clip_end = request.get("clip_end", None)

        # If an audio URL is provided, download it (and transcode if needed);
        # with a clip window the model hears only that stretch.
        tmp_path = self.download_audio(audio_url) if audio_url else None

        try:
            if tmp_path and clip_start is not None and clip_end is not None:
                tmp_path = cut_clip(tmp_path, float(clip_start), float(clip_end))
            response = self.run_prompt(prompt, tmp_path, max_tokens, temperature, top_p, do_sample)
        finally:
            # ---- Clean up temp file ----
            if tmp_path:
                os.unlink(tmp_path)

        elapsed = round(time.time() - start_time, 2)

        return {
            "response": response,
            "elapsed_seconds": elapsed,
        }

    @modal.fastapi_endpoint(method="POST", docs=True, requires_proxy_auth=True)
    def generate_batch(self, request: dict):
        """
        Many short prompts about ONE audio file in one request. The audio is
        downloaded (and transcoded if needed) once; each prompt then runs
        sequentially as its own conversation against the same file. The API
        charges one base price per request, so batching saves the base on
        every prompt after the first.

        JSON body:
        {
            "audio_url": "https://example.com/s.mp3",                (required)
            "prompts": [                                             (required, 1-40)
                {"id": "genre", "prompt": "What genre is this?",
                 "max_new_tokens": 64,                               (optional, 1-2048)
                 "clip_start": 45.2, "clip_end": 60.4,               (optional, seconds; both or
                                                                      neither: the prompt hears
                                                                      only that clip)
                 "temperature": 0.7, "top_p": 0.9, "do_sample": true} (optional, this prompt only)
            ],
            "temperature": 0.2,                                      (optional, default 1.0)
            "top_p": 1.0,                                            (optional, default 1.0)
            "do_sample": false                                       (optional, default false)
        }

        Returns:
        {
            "answers": [{"id": "genre", "response": "...", "elapsed_seconds": 1.2,
                         "clip_start": 45.2, "clip_end": 60.4}],     (clip echoed when one was cut)
            "elapsed_seconds": 9.87      (whole batch, download included)
        }

        Answers come back in prompt order. Any invalid input answers 422
        before the audio is fetched.
        """
        import os
        import time
        from fastapi import HTTPException

        start_time = time.time()

        def reject(detail: str):
            raise HTTPException(status_code=422, detail=f"invalid_batch: {detail}")

        # ---- Validate input (all of it, before any download) ----
        audio_url = request.get("audio_url")
        if not isinstance(audio_url, str) or not audio_url:
            reject("audio_url is required")

        # Generation parameters apply to every prompt that does not set its own
        defaults = {
            "temperature": request.get("temperature", 1.0),
            "top_p": request.get("top_p", 1.0),
            "do_sample": request.get("do_sample", False),
        }
        try:
            jobs = parse_batch_prompts(request.get("prompts"), defaults)
            check_generation_settings(defaults)
        except ValueError as err:
            reject(str(err))

        # ---- Download (and transcode) the audio ONCE ----
        tmp_path = self.download_audio(audio_url)

        # ---- Run every prompt against the same file (or a clip cut from it) ----
        try:
            answers = run_batch(jobs, tmp_path, self.run_prompt)
        finally:
            os.unlink(tmp_path)

        return {
            "answers": answers,
            "elapsed_seconds": round(time.time() - start_time, 2),
        }


# ---------------------------------------------------------------------------
# Local test entrypoint — run with: modal run serve_music_flamingo.py
# ---------------------------------------------------------------------------
@app.local_entrypoint()
def main():
    """Quick smoke test: ask the model a text-only question."""
    flamingo = MusicFlamingo()
    result = flamingo.generate.remote({
        "prompt": "What are the main characteristics of jazz music?",
    })
    print(f"\nModel response:\n{result['response']}")
    print(f"Took {result['elapsed_seconds']}s")
