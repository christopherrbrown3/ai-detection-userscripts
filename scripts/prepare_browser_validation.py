"""Prepare a standalone Playwright async(page) function for local browser QA.

Run with a Playwright runner (or the Playwright MCP run_code tool). All page
responses are synthetic and all other network requests are blocked.
"""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '52c54c3af6315f53550c1d25fa556e237a670afc'
sources = {
    'baseline': subprocess.check_output(['git', 'show', f'{BASELINE}:x-ai-heuristic.userscripts.user.js'], cwd=ROOT, text=True),
    'combined': (ROOT / 'ai-style-cues.userscripts.user.js').read_text(),
    'targeted': (ROOT / 'x-ai-heuristic.userscripts.user.js').read_text(),
}
output = ROOT / 'output/playwright/validate-multisite.js'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text((ROOT / 'tests/browser/multisite-workload.js').read_text().replace('__VALIDATION_SOURCES__', json.dumps(sources)))
print(output)
