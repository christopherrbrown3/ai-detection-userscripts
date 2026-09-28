"""Produce an uncommitted test bundle with an additional adapter via the public builder."""
from pathlib import Path
from tempfile import TemporaryDirectory
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.build_userscripts import ROOT, build, distributions, load_registry, release_version, validate_registry
import json


def example_bundle(status="stable"):
    with TemporaryDirectory() as directory:
        root = Path(directory)
        shutil.copytree(ROOT / "src", root / "src")
        shutil.copy(ROOT / "tests/fixtures/example-adapter.js", root / "src/platforms/example.js")
        registry = load_registry()
        registry["sites"].append({
            "id": "example", "name": "Example", "scriptName": "Example Style Cues",
            "module": "example.js", "description": "Test-only adapter",
            "output": "example.user.js", "hosts": ["example.test"],
            "status": status, "capabilities": ["posts", "comments"], "excludedPaths": ["/messages"],
        })
        validate_registry(registry, root / "src/platforms")
        models = json.loads((ROOT / "models/default-models.json").read_text())
        return build(distributions(registry)[0], models, release_version(), root)


if __name__ == "__main__":
    print(example_bundle(sys.argv[1] if len(sys.argv) > 1 else "stable"))
