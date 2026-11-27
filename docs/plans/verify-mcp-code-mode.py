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
from itertools import combinations
from pathlib import Path

import tiktoken
from jsonschema import Draft202012Validator
from referencing import Registry


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


def contract_cases():
    search = {"query": "catalogs", "id": "catalogs.listOwned", "cursor": "next"}
    for key, value in search.items():
        yield "search", "input", True, key, {key: value}
    for left, right in combinations(search, 2):
        yield "search", "input", False, f"{left} and {right}", {left: search[left], right: search[right]}
    skill = {"id": "catalog-guide", "kind": "skills", "file": "SKILL.md"}
    yield "search", "input", True, "skill file", skill
    yield "search", "input", False, "file without skill", {**skill, "kind": "operations"}
    yield "search", "input", False, "no selection", {}
    item = {"id": "catalogs.listOwned", "summary": "List catalogs", "effect": "read"}
    results = {"revision": "v1", "items": [item]}
    yield "search", "output", True, "summary", results
    for key in item:
        incomplete = {k: v for k, v in item.items() if k != key}
        yield "search", "output", False, f"summary missing {key}", {**results, "items": [incomplete]}
    yield "search", "output", False, "nine summaries", {**results, "items": [item] * 9}

    program = {"source": "async (recoup, params) => params", "revision": "v1", "params": {}}
    receipt = {"runId": "run-1"}
    yield "execute", "input", True, "program", program
    yield "execute", "input", True, "receipt", receipt
    for key, value in program.items():
        yield "execute", "input", False, f"receipt with {key}", {**receipt, key: value}
    yield "execute", "input", False, "program without revision", {"source": program["source"]}
    output = {"traceId": "trace-1", "truncated": False}
    yield "execute", "output", True, "complete", {**output, "state": "complete", "value": []}
    yield "execute", "output", False, "missing complete value", {**output, "state": "complete"}
    for truncated in (True, False):
        yield "execute", "output", True, f"partial truncated={truncated}", {
            **output, "state": "partial", "truncated": truncated, "value": []
        }
    for state in ("complete", "succeeded"):
        yield "execute", "output", False, f"truncated {state}", {
            **output, "state": state, "truncated": True, "value": []
        }

    error = {"code": "outcome_uncertain", "retry": "reconcile"}
    for tool in ("execute", "commit"):
        base = output if tool == "execute" else {"traceId": "trace-1"}
        approval = {**base, **receipt, "state": "approval_required"}
        yield tool, "output", True, "approval link", {**approval, "approvalUrl": "https://recoup.example/approve"}
        yield tool, "output", False, "missing approval link", approval
        for state in ("accepted", "running", "unknown_outcome"):
            status = {**base, "state": state}
            if state == "unknown_outcome":
                status["error"] = error
            yield tool, "output", True, state, {**status, **receipt}
            yield tool, "output", False, f"{state} missing run ID", status
        for state in ("denied", "expired", "failed", "unknown_outcome"):
            status = {**base, **receipt, "state": state}
            yield tool, "output", True, f"{state} with error", {**status, "error": error}
            yield tool, "output", False, f"{state} missing error", status
            yield tool, "output", False, f"{state} missing guidance", {**status, "error": {"code": "failed"}}

    commit = {"intent": "a" * 8192, "requestKey": "request-1"}
    yield "commit", "input", True, "maximum sealed intent", commit
    for length in (0, 8193):
        yield "commit", "input", False, f"sealed length {length}", {**commit, "intent": "a" * length}
    yield "commit", "input", False, "new arguments", {**commit, "args": {"target": "other"}}
    yield "commit", "input", False, "new source", {**commit, "source": program["source"]}


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
        if validators[name, direction].is_valid(payload) != valid:
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
