from copy import deepcopy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from scripts.build_userscripts import ROOT, build, distributions, load_registry, release_version, validate_registry


class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.registry = load_registry()
        self.modules = ROOT / 'src/platforms'

    def reject(self, change):
        registry = deepcopy(self.registry)
        change(registry)
        with self.assertRaises(ValueError):
            validate_registry(registry, self.modules)

    def test_duplicate_identity_outputs_and_names_are_rejected(self):
        self.reject(lambda r: r['sites'].append(deepcopy(r['sites'][0])))
        self.reject(lambda r: r['sites'][1].update(id=r['sites'][0]['id']))
        self.reject(lambda r: r['sites'][1].update(output=r['bundle']['output']))
        self.reject(lambda r: r['sites'][1].update(scriptName=r['sites'][0]['scriptName']))

    def test_host_overlap_and_invalid_patterns_are_rejected(self):
        for host in ['linkedin.com', 'news.linkedin.com', '*.linkedin.com']:
            self.reject(lambda r, h=host: r['sites'][1].update(hosts=[h]))
        for host in ['*', 'https://x.com', 'x.com/*', 'x.com\n// @grant unsafeWindow', '-bad.com']:
            self.reject(lambda r, h=host: r['sites'][1].update(hosts=[h]))

    def test_missing_modules_and_bad_routes_are_rejected(self):
        self.reject(lambda r: r['sites'][0].update(module='missing.js'))
        self.reject(lambda r: r['sites'][0].update(module='../runtime.js'))
        self.reject(lambda r: r['sites'][0].update(excludedPaths=['messages']))
        self.reject(lambda r: r['sites'][0].pop('excludedPaths'))
        self.reject(lambda r: r['sites'][0].pop('scriptName'))
        self.reject(lambda r: r['sites'][0].update(hosts=[{}]))
        self.reject(lambda r: r['sites'][0].update(status='unknown'))

    def test_planned_sites_cannot_enter_a_release_bundle(self):
        self.registry['sites'][0]['status'] = 'planned'
        specs = distributions(self.registry)
        self.assertTrue(all(s['id'] != 'linkedin' for spec in specs for s in spec['sites']))
        with self.assertRaises(ValueError):
            build({'sites': self.registry['sites']}, {}, '0.5.0')

    def test_version_and_lockfile_must_agree(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'package.json').write_text(json.dumps({'version': '0.5.0'}))
            (root / 'package-lock.json').write_text(json.dumps({'version': '0.4.0', 'packages': {'': {'version': '0.4.0'}}}))
            with self.assertRaises(ValueError):
                release_version(root)

    def test_build_is_deterministic_and_preserves_targeted_scope(self):
        models = json.loads((ROOT / 'models/default-models.json').read_text())
        for spec in distributions(self.registry):
            first = build(spec, models, release_version())
            self.assertEqual(first, build(spec, models, release_version()))
            if spec['distribution'] == 'targeted':
                for other in self.registry['sites']:
                    if other['id'] != spec['id']:
                        self.assertNotIn('"' + other['id'] + '": function', first)
                        self.assertNotIn('"' + other['id'] + ':post"', first)


if __name__ == '__main__':
    unittest.main()
