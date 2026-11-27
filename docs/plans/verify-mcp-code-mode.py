"""Verify the proposed direct MCP descriptors and their reference token budget.

Requires jsonschema and tiktoken (reference versions 4.26.0 and 0.14.0).
Preload tiktoken's official o200k_base vocabulary. For a custom cache, set
TIKTOKEN_CACHE_DIR to its directory before running this script. No credentials
or Recoup server are needed.
"""

import hashlib
import json
import os
import sys
import tempfile
from importlib.metadata import version
from pathlib import Path
from urllib.parse import quote

import tiktoken
from jsonschema import Draft202012Validator
from referencing import Registry

from mcp_code_mode_cases import contract_cases


MANIFEST = Path(__file__).with_name("mcp-code-mode-tools.json")
TOKEN_LIMIT = 1_500
VOCABULARY_URL = "https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken"
VOCABULARY_SHA256 = "446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d"


def cached_encoding():
    default_dir = Path(tempfile.gettempdir()) / "data-gym-cache"
    cache_dir = os.environ.get("TIKTOKEN_CACHE_DIR", os.environ.get("DATA_GYM_CACHE_DIR", default_dir))
    cache_key = hashlib.sha1(VOCABULARY_URL.encode()).hexdigest()
    cache_file = Path(cache_dir) / cache_key
    if not cache_dir or not cache_file.is_file():
        raise ValueError(f"Preload the official o200k_base vocabulary in {cache_file}.")
    if hashlib.sha256(cache_file.read_bytes()).hexdigest() != VOCABULARY_SHA256:
        raise ValueError(f"Vocabulary digest mismatch in {cache_file}.")
    return tiktoken.get_encoding("o200k_base")


def trusted_approval_link(payload, receipt_run_id):
    if "approvalUrl" not in payload:
        return True
    if payload.get("runId") != receipt_run_id:
        return False
    expected = "https://app.recoupable.dev/mcp/approvals/" + quote(receipt_run_id, safe="")
    return payload["approvalUrl"] == expected


def main():
    tools = json.loads(MANIFEST.read_text(encoding="utf-8"))["tools"]
    if [tool["name"] for tool in tools] != ["search", "execute", "commit"]:
        raise ValueError("The descriptor fixture must contain search, execute and commit in release order.")
    validators = {}
    for tool in tools:
        for direction in ("input", "output"):
            schema = tool[f"{direction}Schema"]
            Draft202012Validator.check_schema(schema)
            validators[tool["name"], direction] = Draft202012Validator(schema, registry=Registry())

    failures = []
    cases = list(contract_cases())
    for name, direction, valid, label, payload in cases:
        accepted = validators[name, direction].is_valid(payload)
        if direction == "output" and name in {"execute", "commit"}:
            accepted = accepted and trusted_approval_link(payload, receipt_run_id="run-1")
        if accepted != valid:
            failures.append(f"{name} {direction} ({label}): expected {'valid' if valid else 'invalid'}")
    print(f"{len(validators)} schemas, {len(cases)} contract cases, {len(failures)} case failures")
    encoding = cached_encoding()
    print(f"tiktoken {version('tiktoken')}, {encoding.name}")
    for count in (2, 3):
        wire = json.dumps({"tools": tools[:count]}, ensure_ascii=False, separators=(",", ":"))
        tokens = len(encoding.encode_ordinary(wire))
        print(f"{count} descriptors: {len(wire.encode('utf-8')):,} bytes, {tokens:,} tokens")
        if tokens > TOKEN_LIMIT:
            failures.append(f"{count} descriptors exceed the {TOKEN_LIMIT:,}-token gate.")
    for failure in failures:
        print(failure, file=sys.stderr)
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(main())
