"""Positive and negative examples for the proposed direct tool contracts."""

from itertools import combinations


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
        yield tool, "output", True, "approval link", {**approval, "approvalUrl": "https://chat.recoupable.dev/mcp/approvals/run-1"}
        for bad_url in (
            "https://elsewhere.example/mcp/approvals/run-1",
            "http://chat.recoupable.dev/mcp/approvals/run-1",
            "https://chat.recoupable.dev/mcp/approvals/run-2",
            "https://chat.recoupable.dev/mcp/approvals/run-1?next=https://elsewhere.example",
        ):
            yield tool, "output", False, "untrusted approval destination", {**approval, "approvalUrl": bad_url}
        yield tool, "output", False, "foreign receipt and matching URL", {
            **approval, "runId": "run-2", "approvalUrl": "https://chat.recoupable.dev/mcp/approvals/run-2"
        }
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
