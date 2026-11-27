"""Positive and negative examples for the proposed direct tool contracts."""

from itertools import combinations


def contract_cases(action_capable, has_commit):
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
    keyed_program = {**program, "requestKey": "run-key"}
    yield "execute", "input", not action_capable, "program without run key", program
    yield "execute", "input", action_capable, "program with run key", keyed_program
    yield "execute", "input", True, "receipt by run ID", receipt
    yield "execute", "input", action_capable, "recovery after dropped response", {"requestKey": "run-key"}
    yield "execute", "input", action_capable, "resume existing checkpoint", {**receipt, "resume": True}
    yield "execute", "input", False, "resume with new source", {**receipt, "resume": True, "source": program["source"]}
    yield "execute", "input", False, "resume without run ID", {"requestKey": "run-key", "resume": True}
    yield "execute", "input", False, "resume with replacement params", {**receipt, "resume": True, "params": {}}
    yield "execute", "input", False, "mixed recovery identifiers", {**receipt, "requestKey": "run-key"}
    yield "execute", "input", False, "run key too long", {**program, "requestKey": "k" * 97}
    yield "execute", "input", False, "empty run key", {**program, "requestKey": ""}
    yield "execute", "input", False, "ignored approval flag", {**keyed_program, "approved": True}
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
    for tool in (("execute", "commit") if has_commit else ("execute",)):
        base = output if tool == "execute" else {"traceId": "trace-1"}
        approval = {**base, **receipt, "state": "approval_required"}
        exact_intent = {"intent": "sealed_intent"} if tool == "execute" and has_commit else {}
        link = "https://app.recoupable.dev/mcp/approvals/run-1"
        yield tool, "output", action_capable, "approval link", {**approval, "approvalUrl": link, **exact_intent}
        yield tool, "output", False, "approval link after success", {
            **base, **receipt, "state": "succeeded", "approvalUrl": link
        }
        if tool == "execute":
            yield tool, "output", action_capable and not has_commit, "approval without sealed intent", {
                **approval, "approvalUrl": link
            }
            yield tool, "output", has_commit, "optional approved-effect completion", {
                **approval, "approvalUrl": link, "intent": "sealed_intent"
            }
        for bad_url in (
            "https://elsewhere.example/mcp/approvals/run-1",
            "http://app.recoupable.dev/mcp/approvals/run-1",
            "https://app.recoupable.dev/mcp/approvals/run-2",
            "https://app.recoupable.dev/mcp/approvals/run-1?next=https://elsewhere.example",
        ):
            yield tool, "output", False, "untrusted approval destination", {**approval, **exact_intent, "approvalUrl": bad_url}
        yield tool, "output", False, "foreign receipt and matching URL", {
            **approval, **exact_intent, "runId": "run-2", "approvalUrl": "https://app.recoupable.dev/mcp/approvals/run-2"
        }
        yield tool, "output", False, "missing approval link", approval
        for state in ("accepted", "running", "unknown_outcome"):
            status = {**base, "state": state}
            if state == "unknown_outcome":
                status["error"] = error
            yield tool, "output", action_capable or state != "unknown_outcome", state, {**status, **receipt}
            yield tool, "output", False, f"{state} missing run ID", status
        for state in ("denied", "expired", "failed", "unknown_outcome"):
            status = {**base, **receipt, "state": state}
            yield tool, "output", action_capable or state == "failed", f"{state} with error", {**status, "error": error}
            yield tool, "output", False, f"{state} missing error", status
            yield tool, "output", False, f"{state} missing guidance", {**status, "error": {"code": "failed"}}

    if not has_commit:
        return
    commit = {"intent": "a" * 8192, "requestKey": "request-1"}
    yield "commit", "input", True, "maximum sealed intent", commit
    for length in (0, 8193):
        yield "commit", "input", False, f"sealed length {length}", {**commit, "intent": "a" * length}
    yield "commit", "input", False, "malformed intent", {**commit, "intent": "wrong value!"}
    yield "commit", "input", False, "new arguments", {**commit, "args": {"target": "other"}}
    yield "commit", "input", False, "new source", {**commit, "source": program["source"]}


def act_cases():
    """The guest calls act(id, args, {requestKey}); the supervisor supplies authority."""
    call = {"id": "projects.createTask", "args": {"title": "Demo"}, "options": {"requestKey": "step-1"}}
    yield True, "qualified shape", call
    yield False, "missing options", {"id": call["id"], "args": call["args"]}
    yield False, "missing step key", {**call, "options": {}}
    yield False, "empty step key", {**call, "options": {"requestKey": ""}}
    yield False, "oversized step key", {**call, "options": {"requestKey": "k" * 97}}
    yield False, "guest approval override", {**call, "options": {"requestKey": "step-1", "approved": True}}
    yield False, "guest authority override", {**call, "grant": "other"}


def recovery_cases():
    """Wire examples plus trusted, independently queried run/step facts from the fixture."""
    run_id = "run-1"
    steps = [
        {"stepId": "step_1", "state": "succeeded", "receiptRef": "rcpt_1", "readbackRef": "evid_1"},
        {"stepId": "step_2", "state": "unknown_outcome", "receiptRef": "rcpt_2"},
    ]
    failed = {
        "runId": run_id, "state": "failed", "error": {"code": "guest_failed", "retry": "reconcile"},
        "traceId": "trace-1", "truncated": False,
    }
    recovered = {**failed, "value": {"steps": steps}}
    yield True, "two acts then throw, recover by original key", run_id, steps, recovered
    yield True, "source result keeps guest value after admission", run_id, None, {
        "runId": run_id, "state": "complete", "traceId": "trace-1", "truncated": False, "value": "guest value"
    }
    for state in ("complete", "partial", "failed", "canceled", "succeeded"):
        missing_id = {**failed, "state": state, "value": {"steps": steps}}
        del missing_id["runId"]
        yield False, f"admitted {state} missing run ID", run_id, None, missing_id
    early_failure = {k: v for k, v in failed.items() if k != "runId"}
    yield True, "pre-admission rejection", None, None, early_failure
    yield False, "foreign durable run", "run-2", steps, recovered
    yield False, "receipt missing ledger projection", run_id, steps, failed
    for label, entries in (
        ("guest hides an effect", steps[:1]),
        ("guest changes uncertain outcome", [steps[0], {**steps[1], "state": "succeeded"}]),
        ("foreign readback reference", [{**steps[0], "readbackRef": "evid_other"}, steps[1]]),
        ("guest duplicates a receipt", [steps[0], steps[0]]),
        ("guest reorders effects", list(reversed(steps))),
    ):
        yield False, label, run_id, steps, {**recovered, "value": {"steps": entries}}
    for label, entries in (
        ("signed URL in readback", [{**steps[0], "readbackRef": "https://example.test/private?token=demo"}]),
        ("raw provider body", [{**steps[0], "providerResponse": {"internal": True}}]),
        ("too many steps", steps * 9),
    ):
        yield False, label, run_id, entries, {**recovered, "value": {"steps": entries}}
