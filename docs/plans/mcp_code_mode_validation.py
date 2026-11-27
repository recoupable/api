"""Validate direct profile descriptors, tool outputs and pre-admission error envelopes."""

import json
from urllib.parse import quote

from jsonschema import Draft202012Validator
from referencing import Registry

from mcp_code_mode_cases import contract_cases


def trusted_approval_link(payload, receipt_run_id):
    if "approvalUrl" not in payload:
        return True
    if payload.get("state") != "approval_required" or payload.get("runId") != receipt_run_id:
        return False
    expected = "https://app.recoupable.dev/mcp/approvals/" + quote(receipt_run_id, safe="")
    return payload["approvalUrl"] == expected


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
        if name == "execute" and ("intent" in tool["outputSchema"]["properties"]) != has_commit:
            failures.append("Only the approval-completion profile may advertise a sealed intent.")
        for direction in ("input", "output"):
            schema = tool[f"{direction}Schema"]
            Draft202012Validator.check_schema(schema)
            validators[name, direction] = Draft202012Validator(schema, registry=Registry())
    cases = list(contract_cases(action_capable, has_commit))
    for name, direction, valid, label, payload in cases:
        accepted = validators[name, direction].is_valid(payload)
        if direction == "output" and name in {"execute", "commit"}:
            accepted = accepted and trusted_approval_link(payload, receipt_run_id="run-1")
        if accepted != valid:
            failures.append(f"{name} {direction} ({label}): expected {'valid' if valid else 'invalid'}")
    return len(validators), len(cases), failures


def valid_preadmission_refusal(envelope):
    if envelope.get("isError") is not True or "structuredContent" in envelope:
        return False
    blocks = envelope.get("content", [])
    if len(blocks) != 1 or blocks[0].get("type") != "text":
        return False
    body = blocks[0].get("text")
    if not isinstance(body, str) or len(body.encode("utf-8")) > 1024:
        return False
    try:
        error = json.loads(body)
    except ValueError:
        return False
    if not isinstance(error, dict) or error.keys() != {"code", "retry", "traceId"}:
        return False
    return (
        isinstance(error["code"], str) and 0 < len(error["code"]) <= 64
        and isinstance(error["traceId"], str) and 0 < len(error["traceId"]) <= 256
        and error["retry"] in ("narrow", "rediscover", "reconnect", "reconcile", "backoff", "never")
    )
