import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const files = JSON.parse(execFileSync('python3', ['scripts/build_userscripts.py', '--list'], { encoding: 'utf8' }));
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
for (const file of files) {
  test(file + ' has valid, self-contained release metadata and syntax', () => {
    const script = readFileSync(file, 'utf8');
    const metadata = readFileSync(file.replace('.user.js', '.meta.js'), 'utf8');
    assert.match(script, /^\/\/ @inject-into\s+content$/m);
    assert.match(script, /^\/\/ @grant\s+none$/m);
    assert.match(script, /^\/\/ @noframes$/m);
    assert.ok(metadata.includes('// @version      ' + version));
    assert.ok(script.includes(metadata.trim()));
    assert.doesNotMatch(script, /@require|@match\s+\*|\beval\s*\(|\bfetch\s*\(|\bimport\s*\(/);
    execFileSync(process.execPath, ['--check', file]);
  });
}

test('targeted update identities and host permissions stay compatible with v0.4', () => {
  const repository = 'https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/';
  const expected = {
    linkedin: {name:'LinkedIn AI-Style Signal (Local)',hosts:['www.linkedin.com','linkedin.com','*.linkedin.com','m.linkedin.com']},
    x: {name:'X AI-Style Signal (Local)',hosts:['x.com','www.x.com','twitter.com','www.twitter.com']},
    reddit: {name:'Reddit AI-Style Signal (Local)',hosts:['www.reddit.com','reddit.com','old.reddit.com','www.old.reddit.com']}
  };
  const metadata = (file) => [...readFileSync(file,'utf8').matchAll(/^\/\/ @(\S+)\s+([^\n]*)$/gm)];
  const allHosts=[];
  for (const [id, entry] of Object.entries(expected)) {
    const file=id+'-ai-heuristic.userscripts.user.js', fields=metadata(file);
    const get=(key)=>fields.filter((m)=>m[1]===key).map((m)=>m[2]);
    assert.deepEqual(get('name'),[entry.name]);
    assert.deepEqual(get('updateURL'),[repository+file]);
    assert.deepEqual(get('downloadURL'),[repository+file]);
    assert.deepEqual(get('match'),entry.hosts.map(h=>'https://'+h+'/*'));
    allHosts.push(...get('match'));
  }
  const combined=metadata('ai-style-cues.userscripts.user.js');
  assert.deepEqual(combined.filter(m=>m[1]==='match').map(m=>m[2]),allHosts);
  assert.equal(combined.find(m=>m[1]==='updateURL')[2],repository+'ai-style-cues.userscripts.meta.js');
  assert.equal(combined.find(m=>m[1]==='downloadURL')[2],repository+'ai-style-cues.userscripts.user.js');
});
