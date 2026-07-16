import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadModels() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'models/default-models.json'), 'utf8'));
}

export function loadEngine(platform = 'linkedin', bundle = loadModels()) {
  const context = vm.createContext({ console });
  const source = fs.readFileSync(path.join(ROOT, 'src/detector.js'), 'utf8');
  vm.runInContext(`${source}\nthis.__createDetectorEngine = createDetectorEngine;`, context);
  return context.__createDetectorEngine({ platform, modelBundle: bundle });
}

export function loadFixture(name) {
  return fs.readFileSync(path.join(ROOT, 'tests/fixtures', name), 'utf8');
}

export function loadDom(platform, html, url) {
  const dom = new JSDOM(html, {
    url,
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });
  const detector = fs.readFileSync(path.join(ROOT, 'src/detector.js'), 'utf8');
  const runtime = fs.readFileSync(path.join(ROOT, 'src/runtime.js'), 'utf8');
  const adapter = fs.readFileSync(path.join(ROOT, 'src/platforms', `${platform}.js`), 'utf8');
  const bundle = JSON.stringify(loadModels());
  dom.window.eval(`${detector}\n${runtime}\n${adapter}\nthis.__controller = startAIHeuristic(createPlatformAdapter(), ${bundle});`);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
  dom.window.__controller.scanNow();
  return dom;
}
