"""Broker-owned evidence projection and recovery examples for admitted runs."""

import re


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
    yield False, "pre-admission failure outside structured content", None, None, early_failure
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
