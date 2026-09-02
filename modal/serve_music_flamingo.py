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
SCALEDOWN_WINDOW = 300   # 5 min — keeps container warm longer between requests
# Workspace GPU cap is 10; keep this at 4 so a runaway queue cannot
# burn the $100 Modal usage limit (~$8.64/hour vs ~$21.60 at 10 GPUs).
MAX_CONTAINERS = 4
MAX_NEW_TOKENS = 512           # default max tokens to generate
MODEL_CACHE_DIR = "/model_cache"  # where model weights live inside the container


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


# ---------------------------------------------------------------------------
# Modal Image — the "Docker image" that runs on the cloud GPU.
# Key optimization: .run_function(download_model_weights) bakes the 16GB
# model weights directly into the image so they're pre-loaded on disk.
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.11")
    # System libraries for audio processing
    .apt_install("ffmpeg", "libsndfile1", "git")
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
    )
    # Custom transformers fork with Music Flamingo support
    .pip_install(
        "git+https://github.com/lashahub/transformers@modular-mf",
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
            torch_dtype=torch.bfloat16,
            attn_implementation="sdpa",
            low_cpu_mem_usage=True,
        )

        print("Model loaded with SDPA attention!")

    @modal.fastapi_endpoint(method="GET", docs=True)
    def health(self):
        """
        Quick health check — returns instantly if the container is alive
        and the model is loaded. Useful for monitoring or pre-warming.

        GET /health → {"status": "ok", "model": "nvidia/music-flamingo-2601-hf"}
        """
        return {"status": "ok", "model": MODEL_ID}

    @modal.fastapi_endpoint(method="POST", docs=True)
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
            "do_sample": false                         (optional, default false)
        }

        Returns:
        {
            "response": "...",
            "elapsed_seconds": 3.21
        }
        """
        import requests as http_requests
        import tempfile
        import os
        import time
        from urllib.parse import urlparse

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

        # ---- Build the conversation ----
        # Music Flamingo uses a chat-style format with "user" and "assistant" roles
        content = [{"type": "text", "text": prompt}]
        tmp_path = None

        # If an audio URL is provided, download it and add to the conversation
        if audio_url:
            audio_response = http_requests.get(audio_url)
            audio_response.raise_for_status()

            # Strip query params before extracting extension — signed URLs
            # (CloudFront, S3, Supabase Storage) append ?Expires=...&Signature=...
            # which os.path.splitext would include in the "extension", creating
            # filenames that exceed the OS 255-char limit.
            url_path = urlparse(audio_url).path
            ext = os.path.splitext(url_path)[-1] or ".mp3"
            tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
            tmp.write(audio_response.content)
            tmp.flush()
            tmp_path = tmp.name
            tmp.close()

            content.append({"type": "audio", "path": tmp_path})

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

        # ---- Clean up temp file ----
        if tmp_path:
            os.unlink(tmp_path)

        elapsed = round(time.time() - start_time, 2)

        return {
            "response": decoded[0],
            "elapsed_seconds": elapsed,
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
