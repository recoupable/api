"""Bundle the committed, self-contained Recoup Sites skill for deployment."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

source = Path(sys.argv[1]).resolve()
revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
if subprocess.check_output(["git", "-C", str(source), "status", "--porcelain", "--", "."], text=True).strip():
    raise SystemExit("Commit the source skill before bundling it")
visual = source / "references/visual-experiences"
topics = {name: (visual / (name + ".md")).read_text() for name in ["principles", "motion-recipes", "interactive-3d", "briefs-and-review", "production", "toolkits"]}
examples = []
for match in re.finditer(r"^## (\d+)\. ([^\n]+)\n(.*?)(?=^## \d+\.|\Z)", (visual / "examples.md").read_text(), re.M | re.S):
    examples.append({"id": int(match[1]), "name": match[2], "content": match[3].strip()})
if len(examples) != 104 or len({item["id"] for item in examples}) != 104:
    raise SystemExit("Expected 104 uniquely numbered visual references")
visual_data = {"name": "design-visual-experiences", "guide": (visual / "GUIDE.md").read_text(), "topics": topics, "examples": examples}
visual_data["sourceHash"] = hashlib.sha256(json.dumps(visual_data, sort_keys=True).encode()).hexdigest()
bundle = {"name": "recoup-content-build-sites", "revision": revision, "skill": (source / "SKILL.md").read_text(), "principles": (source / "references/principles.md").read_text(), "buildAndReview": (source / "references/build-and-review.md").read_text(), "references": json.loads((source / "references/library.json").read_text())["references"], "visualExperience": visual_data}
Path("lib/sites/skills/bundle.json").write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n")
print(f"Bundled {len(bundle['references'])} interaction and {len(examples)} visual references at {revision}")
