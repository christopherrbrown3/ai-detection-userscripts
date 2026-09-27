"""Embed the current artifacts and synthetic Facebook fixture for Playwright QA."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
sources = {
    "combined": (ROOT / "ai-style-cues.userscripts.user.js").read_text(),
    "targeted": (ROOT / "facebook-ai-heuristic.userscripts.user.js").read_text(),
}
output = ROOT / "output/playwright/validate-facebook.js"
output.parent.mkdir(parents=True, exist_ok=True)
source = (ROOT / "tests/browser/facebook-validation.js").read_text()
source = source.replace("__FACEBOOK_SOURCES__", json.dumps(sources))
source = source.replace("__FACEBOOK_FIXTURE__", json.dumps((ROOT / "tests/fixtures/facebook.html").read_text()))
source = source.replace("__FACEBOOK_OUTPUT__", json.dumps(str(output.parent)))
output.write_text(source)
print(output)
