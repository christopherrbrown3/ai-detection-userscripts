import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/detector.js'), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(`${source}\nthis.__createDetectorEngine = createDetectorEngine;`, context);
const engine = context.__createDetectorEngine({ platform: 'linkedin', modelBundle: { models: {} } });
const requests = JSON.parse(fs.readFileSync(0, 'utf8'));
const output = requests.map((request) => {
  const extracted = engine.extractFeatures(request.text, { kind: request.kind || 'post' });
  return {
    features: extracted.features,
    metrics: extracted.metrics,
    charNgrams: extracted.charNgrams
  };
});
process.stdout.write(JSON.stringify(output));
