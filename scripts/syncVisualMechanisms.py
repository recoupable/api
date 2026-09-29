"""Pin the user-authored visual skill's small implementation library for Sites agents.

Usage: python3 scripts/syncVisualMechanisms.py /path/to/design-visual-experiences
No runtime filesystem access or network loading is needed by the deployed agents.
"""
import hashlib
import json
from pathlib import Path
import sys

source = Path(sys.argv[1]).resolve()
chapters = ["principles", "compositions", "diagnosis", "build-patterns", "briefs-and-review"]
patterns = json.loads((source / "references/patterns.json").read_text())
if not patterns or len({item["id"] for item in patterns}) != len(patterns):
    raise SystemExit("Expected nonempty uniquely identified visual patterns")
bundle = {
    "name": "design-visual-experiences",
    "guide": (source / "SKILL.md").read_text(),
    "chapters": {name: (source / f"references/{name}.md").read_text() for name in chapters},
    "patterns": patterns,
    "kernels": {name: (source / f"assets/{name}-kernel.mjs").read_text() for name in ["motion", "experience"]},
}
bundle["sourceHash"] = hashlib.sha256(json.dumps(bundle, sort_keys=True).encode()).hexdigest()
Path("lib/sites/skills/visualMechanisms.json").write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n")
print(f"Pinned {len(patterns)} visual mechanisms: {bundle['sourceHash']}")
