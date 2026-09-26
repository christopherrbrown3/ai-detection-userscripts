from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "https://github.com/christopherrbrown3/ai-detection-userscripts"
RAW_REPOSITORY = f"https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main"
HOST = re.compile(r"(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*")


def host_covers(pattern: str, host: str) -> bool:
    if pattern.startswith("*."):
        base = pattern[2:]
        return host == base or host.endswith("." + base)
    return pattern == host


def hosts_overlap(left: str, right: str) -> bool:
    return host_covers(left, right.removeprefix("*.")) or host_covers(right, left.removeprefix("*."))


def load_registry(root: Path = ROOT) -> dict:
    registry = json.loads((root / "src/platforms/registry.json").read_text())
    validate_registry(registry, root / "src/platforms")
    return registry


def validate_registry(registry: dict, module_root: Path) -> None:
    if registry.get("schemaVersion") != 1 or not isinstance(registry.get("sites"), list):
        raise ValueError("Expected registry schemaVersion 1 and sites array")
    outputs, ids, names, hosts = set(), set(), set(), []
    bundle = registry.get("bundle", {})
    for spec in [bundle, *registry["sites"]]:
        output = spec.get("output", "")
        if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.user\.js", output) or output in outputs:
            raise ValueError(f"Invalid or duplicate output: {output}")
        outputs.add(output)
        name = spec.get("scriptName", spec.get("name"))
        if not isinstance(name, str) or not name or name in names:
            raise ValueError("Missing or duplicate userscript name")
        names.add(name)
        if any(not isinstance(spec.get(key), str) or "\n" in spec[key] or "\r" in spec[key]
               for key in ["name", "description"]):
            raise ValueError("Invalid script metadata")
        if "\n" in name or "\r" in name:
            raise ValueError("Invalid userscript name")
    for site in registry["sites"]:
        if not isinstance(site.get("scriptName"), str) or not site["scriptName"]:
            raise ValueError("Missing site scriptName")
        ident = site.get("id", "")
        if not re.fullmatch(r"[a-z][a-z0-9-]*", ident) or ident in ids:
            raise ValueError(f"Invalid or duplicate site id: {ident}")
        ids.add(ident)
        if site.get("status") not in ["stable", "experimental", "planned"]:
            raise ValueError(f"Invalid support status: {ident}")
        module = site.get("module", "")
        if not re.fullmatch(r"[a-z][a-z0-9-]*\.js", module) or not (module_root / module).is_file():
            raise ValueError(f"Missing or invalid adapter module: {ident}")
        if not isinstance(site.get("capabilities"), list) or not all(isinstance(c, str) for c in site["capabilities"]):
            raise ValueError(f"Invalid capabilities: {ident}")
        if not isinstance(site.get("hosts"), list) or not site["hosts"] or not all(isinstance(h, str) for h in site["hosts"]):
            raise ValueError(f"Missing hosts: {ident}")
        if len(site["hosts"]) != len(set(site["hosts"])):
            raise ValueError(f"Duplicate host: {ident}")
        for host in site["hosts"]:
            if not isinstance(host, str) or not HOST.fullmatch(host):
                raise ValueError(f"Invalid host: {host}")
            for other, owner in hosts:
                if owner != ident and hosts_overlap(host, other):
                    raise ValueError(f"Ambiguous host ownership: {host}, {other}")
            hosts.append((host, ident))
        paths = site.get("excludedPaths")
        if not isinstance(paths, list) or any(not isinstance(p, str) or not re.fullmatch(r"/[A-Za-z0-9_/-]+", p) or p.endswith("/") for p in paths):
            raise ValueError(f"Invalid excludedPaths: {ident}")


def release_version(root: Path = ROOT) -> str:
    version = json.loads((root / "package.json").read_text())["version"]
    lock = json.loads((root / "package-lock.json").read_text())
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Release version must be major.minor.patch")
    if lock.get("version") != version or lock.get("packages", {}).get("", {}).get("version") != version:
        raise ValueError("package-lock.json version differs from package.json")
    return version


def distributions(registry: dict) -> list[dict]:
    sites = [site for site in registry["sites"] if site["status"] != "planned"]
    if not sites:
        raise ValueError("A release needs at least one implemented site")
    return [{**registry["bundle"], "distribution": "combined", "sites": sites}, *[
        {**site, "name": site["scriptName"], "distribution": "targeted", "sites": [site]} for site in sites
    ]]


def metadata(spec: dict, version: str) -> str:
    url = f"{RAW_REPOSITORY}/{spec['output']}"
    # Keep existing targeted update URLs; canonical metadata uses its .meta.js companion.
    update_url = url.replace(".user.js", ".meta.js") if spec["distribution"] == "combined" else url
    lines = ["// ==UserScript==", f"// @name         {spec['name']}", f"// @namespace    {REPOSITORY}",
             f"// @version      {version}", f"// @description  {spec['description']}",
             "// @author       christopherrbrown3", "// @license      MIT",
             f"// @homepageURL  {REPOSITORY}", f"// @supportURL   {REPOSITORY}/issues",
             f"// @downloadURL  {url}", f"// @updateURL    {update_url}"]
    matches = dict.fromkeys(f"https://{host}/*" for site in spec["sites"] for host in site["hosts"])
    lines.extend(f"// @match        {match}" for match in matches)
    lines.extend(["// @run-at       document-idle", "// @inject-into  content", "// @grant        none",
                  "// @noframes", "// ==/UserScript=="])
    return "\n".join(lines)


def build(spec: dict, model_bundle: dict, version: str, root: Path = ROOT) -> str:
    sites = spec["sites"]
    if any(site["status"] == "planned" for site in sites):
        raise ValueError("Planned sites cannot be bundled")
    shared = "\n\n".join((root / "src" / name).read_text().rstrip()
                           for name in ["detector.js", "runtime.js", "bootstrap.js"])
    factories = []
    for site in sites:
        source = (root / "src/platforms" / site["module"]).read_text().rstrip()
        factories.append(f"{json.dumps(site['id'])}: function () {{\n{source}\nreturn createPlatformAdapter();\n}}")
    registry = [{key: site[key] for key in ["id", "name", "hosts", "status", "capabilities", "excludedPaths"]} for site in sites]
    models = {**model_bundle, "models": {key: value for key, value in model_bundle.get("models", {}).items()
                                        if key == "default" or any(key.startswith(site["id"] + ":") for site in sites)}}
    compact = lambda value: json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return ("// Generated file. Edit src/, models/, or scripts/build_userscripts.py instead.\n"
            f"// Installation and documentation: {REPOSITORY}\n\n{metadata(spec, version)}\n\n"
            "(function () {\n  'use strict';\n\n" + shared + "\n\n"
            "  const factories = {\n" + ",\n".join(factories) + "\n  };\n"
            f"  bootAIHeuristic({compact(registry)}, factories, {compact(models)}, "
            f"{{version:{json.dumps(version)},distribution:{json.dumps(spec['distribution'])}}});\n"
            "})();\n")


def artifacts(root: Path = ROOT) -> dict[str, str]:
    registry, version = load_registry(root), release_version(root)
    models = json.loads((root / "models/default-models.json").read_text())
    outputs = {}
    for spec in distributions(registry):
        outputs[spec["output"]] = build(spec, models, version, root)
        outputs[spec["output"].replace(".user.js", ".meta.js")] = metadata(spec, version) + "\n"
    rows = ["# Supported sites", "", "Generated from src/platforms/registry.json. Do not edit by hand.", "",
            "| Site | Status | Hosts | Verified layout coverage | Excluded route prefixes |",
            "| --- | --- | --- | --- | --- |"]
    for site in registry["sites"]:
        rows.append("| " + " | ".join([site["name"], site["status"], ", ".join(site["hosts"]),
                                        ", ".join(site["capabilities"]), ", ".join(site["excludedPaths"]) or "—"]) + " |")
    outputs["docs/supported-sites.md"] = "\n".join(rows) + "\n"
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser(description="Build self-contained multi-site and targeted userscripts.")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--list", action="store_true", help="Print generated userscript filenames as JSON")
    args = parser.parse_args()
    if args.list:
        print(json.dumps([spec["output"] for spec in distributions(load_registry())]))
        return
    stale = []
    for name, expected in artifacts().items():
        output = ROOT / name
        if args.check:
            if not output.exists() or output.read_text() != expected:
                stale.append(name)
        else:
            output.write_text(expected)
            print(f"Wrote {name}")
    if stale:
        raise SystemExit("Generated artifacts are stale: " + ", ".join(stale))


if __name__ == "__main__":
    main()
