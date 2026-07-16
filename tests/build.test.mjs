import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const platform of ['linkedin', 'x', 'reddit']) {
  test(`${platform} uses Safari CSP-safe content injection`, () => {
    const script = readFileSync(`${platform}-ai-heuristic.userscripts.user.js`, 'utf8');
    assert.match(script, /^\/\/ @inject-into\s+content$/m);
  });
}
