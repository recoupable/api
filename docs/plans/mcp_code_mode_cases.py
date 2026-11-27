"""Positive and negative examples for the proposed direct tool contracts."""

from itertools import combinations

from mcp_code_mode_execution_cases import execute_cases, status_cases


def search_cases():
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



def commit_cases():
    commit = {"intent": "a" * 8192, "requestKey": "request-1"}
    yield "commit", "input", True, "maximum sealed intent", commit
    for length in (0, 8193):
        yield "commit", "input", False, f"sealed length {length}", {**commit, "intent": "a" * length}
    yield "commit", "input", False, "malformed intent", {**commit, "intent": "wrong value!"}
    yield "commit", "input", False, "new arguments", {**commit, "args": {"target": "other"}}
    yield "commit", "input", False, "new source", {**commit, "source": "async (recoup, params) => params"}


def act_cases():
    """The guest calls recoup.act(id, args, {requestKey}); the supervisor supplies authority."""
    call = {"id": "projects.createTask", "args": {"title": "Demo"}, "options": {"requestKey": "step-1"}}
    yield True, "qualified shape", call
    yield False, "missing options", {"id": call["id"], "args": call["args"]}
    yield False, "missing step key", {**call, "options": {}}
    yield False, "empty step key", {**call, "options": {"requestKey": ""}}
    yield False, "oversized step key", {**call, "options": {"requestKey": "k" * 97}}
    yield False, "guest approval override", {**call, "options": {"requestKey": "step-1", "approved": True}}
    yield False, "guest authority override", {**call, "grant": "other"}


def contract_cases(action_capable, has_commit):
    yield from search_cases()
    yield from execute_cases(action_capable)
    yield from status_cases(action_capable, has_commit)
    if has_commit:
        yield from commit_cases()


def refusal_cases():
    block = {"type": "text", "text": '{"code":"not_admitted","retry":"reconnect","traceId":"trace-0"}'}
    refusal = {"isError": True, "content": [block]}
    yield True, "legacy pre-admission tool error", refusal
    yield True, "modern pre-admission tool error", {**refusal, "resultType": "complete"}
    yield False, "fabricated structured run", {**refusal, "structuredContent": {"state": "failed"}}
    yield False, "not a tool error", {**refusal, "isError": False}
    yield False, "unbounded payload", {**refusal, "content": [{**block, "text": "x" * 1025}]}
    yield False, "malformed JSON", {**refusal, "content": [{**block, "text": "invalid"}]}
    yield False, "raw personal data", {
        **refusal, "content": [{**block, "text": '{"code":"denied","retry":"never","traceId":"t","private":"demo"}'}]
    }
