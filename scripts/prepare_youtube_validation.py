"""Embed the current artifacts and synthetic YouTube fixture for Playwright QA."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
sources = {
    "combined": (ROOT / "ai-style-cues.userscripts.user.js").read_text(),
    "targeted": (ROOT / "youtube-ai-heuristic.userscripts.user.js").read_text(),
}
output = ROOT / "output/playwright/validate-youtube.js"
output.parent.mkdir(parents=True, exist_ok=True)
source = (ROOT / "tests/browser/youtube-validation.js").read_text()
source = source.replace("__YOUTUBE_SOURCES__", json.dumps(sources))
source = source.replace("__YOUTUBE_FIXTURE__", json.dumps((ROOT / "tests/fixtures/youtube.html").read_text()))
source = source.replace("__YOUTUBE_OUTPUT__", json.dumps(str(output.parent)))
output.write_text(source)
print(output)
