import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const DOMS = new Set();
export function closeDoms() { for (const dom of [...DOMS]) dom.window.close(); }

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

export function loadDom(platform, html, url, options = {}) {
  const dom = new JSDOM(html, {
    url,
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });
  if (options.setup) options.setup(dom.window);
  const detector = fs.readFileSync(path.join(ROOT, 'src/detector.js'), 'utf8');
  const runtime = fs.readFileSync(path.join(ROOT, 'src/runtime.js'), 'utf8');
  const adapter = fs.readFileSync(path.join(ROOT, 'src/platforms', `${platform}.js`), 'utf8');
  const bundle = JSON.stringify(loadModels());
  dom.window.eval(`${detector}\n${runtime}\n${adapter}\nthis.__controller = startAIHeuristic(createPlatformAdapter(), ${bundle}, ${JSON.stringify(options.runtimeOptions || {})});`);
  Object.defineProperty(dom.window.document, 'readyState', { value: 'interactive', configurable: true });
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
  if (options.autoScan !== false) dom.window.__controller.scanNow();
  DOMS.add(dom);
  const close = dom.window.close.bind(dom.window);
  dom.window.close = () => { dom.window.__controller.stop(); DOMS.delete(dom); close(); };
  return dom;
}

export function registry() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'src/platforms/registry.json'), 'utf8'));
}

export function bundleSource(platform, distribution = 'combined') {
  const entry = distribution === 'combined' ? registry().bundle : registry().sites.find((site) => site.id === platform);
  return fs.readFileSync(path.join(ROOT, entry.output), 'utf8');
}

export function evaluateBundle(window, source) {
  const call = '  bootAIHeuristic(';
  assertStartup(source, call);
  // Capture only the return value; production code exposes no window globals.
  window.eval(source.replace(call, '  window.__lastSession = bootAIHeuristic('));
  window.__sessions = window.__sessions || [];
  if (window.__lastSession) window.__sessions.push(window.__lastSession);
  return window.__lastSession;
}

function assertStartup(source, call) {
  if (source.split(call).length !== 2) throw new Error('Expected one generated bootstrap call');
}

export function loadGeneratedDom(platform, html, url, options = {}) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: 'outside-only' });
  if (options.setup) options.setup(dom.window);
  const session = evaluateBundle(dom.window, options.source || bundleSource(platform, options.distribution));
  Object.defineProperty(dom.window.document, 'readyState', { value: 'interactive', configurable: true });
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
  dom.window.__controller = session && session.getController();
  if (options.autoScan !== false && dom.window.__controller) dom.window.__controller.scanNow();
  DOMS.add(dom);
  const close = dom.window.close.bind(dom.window);
  dom.window.close = () => { for (const current of dom.window.__sessions || []) current.stop(); DOMS.delete(dom); close(); };
  return dom;
}
