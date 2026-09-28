"""Build an isolated synthetic layout check against the 0.6.0 release."""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
baseline = subprocess.check_output(
    ["git", "show", "308ab617:ai-style-cues.userscripts.user.js"], cwd=ROOT, text=True
)
sources = {"baseline": baseline, "current": (ROOT / "ai-style-cues.userscripts.user.js").read_text()}
for key in sources:
    anchor = "  bootAIHeuristic("
    assert sources[key].count(anchor) == 1
    sources[key] = sources[key].replace(anchor, "  window.__session=bootAIHeuristic(")
output = ROOT / "output/playwright/validate-badges.js"
output.parent.mkdir(parents=True, exist_ok=True)
code = (ROOT / "tests/browser/badge-layout.js").read_text()
code = code.replace("__BADGE_SOURCES__", json.dumps(sources))
code = code.replace("__BADGE_OUTPUT__", json.dumps(str(output.parent)))
output.write_text(code)
print(output)
