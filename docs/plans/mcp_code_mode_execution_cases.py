"""Input, result and status examples for direct execution."""


def execute_cases(action_capable):
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
    if action_capable:
        output.update(receipt)
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

    bare = {"state": "complete", "traceId": "trace-1", "truncated": False, "value": []}
    yield "execute", "output", not action_capable, "complete without durable run ID", bare
    for state in ("partial", "canceled", "succeeded", "failed"):
        result = {**bare, "state": state}
        if state == "failed":
            result["error"] = {"code": "guest_failed", "retry": "never"}
        yield "execute", "output", not action_capable, f"{state} without durable run ID", result


def status_cases(action_capable, has_commit):
    receipt = {"runId": "run-1"}
    output = {"traceId": "trace-1", "truncated": False}
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
        if tool == "execute":
            yield tool, "output", False, "sealed intent on unpaused run", {
                **base, **receipt, "state": "running", "intent": "sealed_intent"
            }
            yield tool, "output", False, "invalid sealed token on pause", {
                **approval, "approvalUrl": link, "intent": "malformed token!"
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
