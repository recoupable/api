"""Verify the proposed direct MCP descriptors and their reference token budget.

Requires jsonschema and tiktoken (reference versions 4.26.0 and 0.14.0).
Preload tiktoken's official o200k_base vocabulary. For a custom cache, set
TIKTOKEN_CACHE_DIR to its directory before running this script. No credentials
or Recoup server are needed.
"""

import hashlib
import json
import os
import re
import sys
import tempfile
from importlib.metadata import version
from pathlib import Path
from urllib.parse import quote

import tiktoken
from jsonschema import Draft202012Validator
from referencing import Registry

from mcp_code_mode_cases import act_cases, contract_cases, recovery_cases


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
    if payload.get("state") != "approval_required" or payload.get("runId") != receipt_run_id:
        return False
    expected = "https://app.recoupable.dev/mcp/approvals/" + quote(receipt_run_id, safe="")
    return payload["approvalUrl"] == expected


def valid_recovery(payload, run_id, ledger_steps):
    """Check the broker projection against an authorized receipt, never guest claims."""
    if payload.get("runId") != run_id:
        return False
    if ledger_steps is None:
        return True
    if run_id is None or len(ledger_steps) > 16 or payload.get("value") != {"steps": ledger_steps}:
        return False
    required = {"stepId", "state", "receiptRef"}
    allowed = required | {"readbackRef"}
    step_ids = set()
    for step in ledger_steps:
        if not isinstance(step, dict) or not required <= step.keys() <= allowed:
            return False
        if step["state"] not in {
            "approval_required", "accepted", "running", "succeeded", "failed",
            "denied", "expired", "canceled", "unknown_outcome"
        }:
            return False
        for key in step.keys() - {"state"}:
            if not isinstance(step[key], str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", step[key]):
                return False
        if step["stepId"] in step_ids:
            return False
        step_ids.add(step["stepId"])
    return True


def verify_profile(tools, action_capable, has_commit):
    expected_names = ["search", "execute"] + (["commit"] if has_commit else [])
    if [tool["name"] for tool in tools] != expected_names:
        raise ValueError(f"Expected descriptors in order {expected_names}.")
    failures = []
    validators = {}
    for tool in tools:
        name = tool["name"]
        effectful = name == "commit" or (name == "execute" and action_capable)
        expected_hints = {
            "readOnlyHint": not effectful,
            "destructiveHint": effectful,
            "openWorldHint": effectful,
        }
        if tool["annotations"] != expected_hints:
            failures.append(f"{name} annotations differ from the fixture's admitted effects.")
        for direction in ("input", "output"):
            schema = tool[f"{direction}Schema"]
            Draft202012Validator.check_schema(schema)
            validators[name, direction] = Draft202012Validator(schema, registry=Registry())
    cases = list(contract_cases(action_capable, has_commit))
    for name, direction, valid, label, payload in cases:
        accepted = validators[name, direction].is_valid(payload)
        if direction == "output" and name in {"execute", "commit"}:
            accepted = accepted and trusted_approval_link(payload, receipt_run_id="run-1")
            if name == "execute" and "intent" in payload:
                accepted = accepted and has_commit and payload.get("state") == "approval_required"
            if name == "execute" and has_commit and payload.get("state") == "approval_required":
                accepted = accepted and "intent" in payload
        if accepted != valid:
            failures.append(f"{name} {direction} ({label}): expected {'valid' if valid else 'invalid'}")
    return len(validators), len(cases), failures


def main():
    fixture = json.loads(MANIFEST.read_text(encoding="utf-8"))
    search, execute, commit = fixture["tools"]
    read_execute = {**execute, **fixture["readOnlyExecute"]}
    profiles = [
        ("Read only", [search, read_execute], False, False),
        ("Delegated action", [search, execute], True, False),
        ("Delegated action with approval completion", [search, execute, commit], True, True),
    ]
    encoding = cached_encoding()
    print(f"tiktoken {version('tiktoken')}, {encoding.name}")
    failures = []
    for profile, tools, action_capable, has_commit in profiles:
        schemas, cases, mismatches = verify_profile(tools, action_capable, has_commit)
        failures.extend(f"{profile}: {message}" for message in mismatches)
        wire = json.dumps({"tools": tools}, ensure_ascii=False, separators=(",", ":"))
        tokens = len(encoding.encode_ordinary(wire))
        print(f"{profile}: {len(tools)} descriptors, {schemas} schemas, {cases} cases, "
              f"{len(wire.encode('utf-8')):,} bytes, {tokens:,} tokens")
        if tokens > TOKEN_LIMIT:
            failures.append(f"{profile} exceeds the {TOKEN_LIMIT:,}-token gate.")
    schema = fixture["actRequest"]
    Draft202012Validator.check_schema(schema)
    act_validator = Draft202012Validator(schema, registry=Registry())
    cases = list(act_cases())
    for valid, label, request in cases:
        if act_validator.is_valid(request) != valid:
            failures.append(f"Guest act request ({label}): expected {'valid' if valid else 'invalid'}")
    print(f"Guest act RPC: 1 schema, {len(cases)} cases (excluded from MCP descriptor counts)")
    action_output = Draft202012Validator(execute["outputSchema"], registry=Registry())
    recoveries = list(recovery_cases())
    for valid, label, run_id, ledger_steps, payload in recoveries:
        accepted = action_output.is_valid(payload) and valid_recovery(payload, run_id, ledger_steps)
        if accepted != valid:
            failures.append(f"Broker recovery ({label}): expected {'valid' if valid else 'invalid'}")
    print(f"Broker recovery: {len(recoveries)} cases (conditional status projection)")
    for failure in failures:
        print(failure, file=sys.stderr)
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(main())
