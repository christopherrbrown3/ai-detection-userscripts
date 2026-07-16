import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/detector.js'), 'utf8');
const request = JSON.parse(fs.readFileSync(0, 'utf8'));
const context = vm.createContext({ console });
vm.runInContext(`${source}\nthis.__createDetectorEngine = createDetectorEngine;`, context);
const engine = context.__createDetectorEngine({ platform: request.platform, modelBundle: request.bundle });
const analysis = engine.analyze(
  request.text,
  { kind: request.kind },
  { sensitivity: 'balanced' }
);
process.stdout.write(JSON.stringify({ signal: analysis.signal, label: analysis.label, calibrated: analysis.calibrated }));
