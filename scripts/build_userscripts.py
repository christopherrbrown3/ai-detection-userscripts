from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.3.0"
REPOSITORY = "https://github.com/christopherrbrown3/ai-detection-userscripts"
RAW_REPOSITORY = "https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main"

PLATFORMS = {
    "linkedin": {
        "name": "LinkedIn AI-Style Signal (Local)",
        "description": "Adds an experimental, privacy-preserving AI-style signal to LinkedIn posts and comments.",
        "output": "linkedin-ai-heuristic.userscripts.user.js",
        "matches": [
            "https://www.linkedin.com/*",
            "https://linkedin.com/*",
            "https://*.linkedin.com/*",
            "https://m.linkedin.com/*",
        ],
    },
    "x": {
        "name": "X AI-Style Signal (Local)",
        "description": "Adds an experimental, privacy-preserving AI-style signal to X/Twitter posts and replies.",
        "output": "x-ai-heuristic.userscripts.user.js",
        "matches": [
            "https://x.com/*",
            "https://www.x.com/*",
            "https://twitter.com/*",
            "https://www.twitter.com/*",
        ],
    },
    "reddit": {
        "name": "Reddit AI-Style Signal (Local)",
        "description": "Adds an experimental, privacy-preserving AI-style signal to Reddit posts and comments.",
        "output": "reddit-ai-heuristic.userscripts.user.js",
        "matches": [
            "https://www.reddit.com/*",
            "https://reddit.com/*",
            "https://old.reddit.com/*",
            "https://www.old.reddit.com/*",
        ],
    },
}


def metadata(platform: str, spec: dict[str, object]) -> str:
    output = str(spec["output"])
    raw_url = f"{RAW_REPOSITORY}/{output}"
    lines = [
        "// ==UserScript==",
        f"// @name         {spec['name']}",
        f"// @namespace    {REPOSITORY}",
        f"// @version      {VERSION}",
        f"// @description  {spec['description']}",
        "// @author       christopherrbrown3",
        "// @license      MIT",
        f"// @homepageURL  {REPOSITORY}",
        f"// @supportURL   {REPOSITORY}/issues",
        f"// @downloadURL  {raw_url}",
        f"// @updateURL    {raw_url}",
    ]
    lines.extend(f"// @match        {match}" for match in spec["matches"])
    lines.extend([
        "// @run-at       document-idle",
        "// @inject-into  content",
        "// @grant        none",
        "// @noframes",
        "// ==/UserScript==",
    ])
    return "\n".join(lines)


def build(platform: str, spec: dict[str, object], model_bundle: dict[str, object]) -> str:
    detector = (ROOT / "src" / "detector.js").read_text(encoding="utf-8").rstrip()
    runtime = (ROOT / "src" / "runtime.js").read_text(encoding="utf-8").rstrip()
    adapter = (ROOT / "src" / "platforms" / f"{platform}.js").read_text(encoding="utf-8").rstrip()
    platform_bundle = {
        "schema_version": model_bundle.get("schema_version", 2),
        "metadata": model_bundle.get("metadata", {}),
        "models": {
            key: value
            for key, value in model_bundle.get("models", {}).items()
            if key == "default" or key.startswith(f"{platform}:")
        },
    }
    models = json.dumps(platform_bundle, ensure_ascii=False, separators=(",", ":"))
    install_url = REPOSITORY
    return f"""// Generated file. Edit src/, models/default-models.json, or scripts/build_userscripts.py instead.
// Installation and documentation: {install_url}

{metadata(platform, spec)}

(function () {{
  'use strict';

  const AI_HEURISTIC_MODELS = {models};

{detector}

{runtime}

{adapter}

  startAIHeuristic(createPlatformAdapter(), AI_HEURISTIC_MODELS);
}})();
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Build self-contained userscripts from shared sources.")
    parser.add_argument("--check", action="store_true", help="Fail when generated files are not current.")
    args = parser.parse_args()

    model_bundle = json.loads((ROOT / "models" / "default-models.json").read_text(encoding="utf-8"))
    stale: list[str] = []
    for platform, spec in PLATFORMS.items():
        output = ROOT / str(spec["output"])
        expected = build(platform, spec, model_bundle)
        if args.check:
            if not output.exists() or output.read_text(encoding="utf-8") != expected:
                stale.append(str(output.relative_to(ROOT)))
        else:
            output.write_text(expected, encoding="utf-8")
            print(f"Wrote {output.relative_to(ROOT)}")

    if stale:
        raise SystemExit("Generated userscripts are stale: " + ", ".join(stale))


if __name__ == "__main__":
    main()
