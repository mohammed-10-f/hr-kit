import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const vendor = path.join(root, 'public', 'vendor');
fs.mkdirSync(vendor, { recursive: true });

const files = [
  ['pdfjs-dist/build/pdf.min.js', 'pdf.min.js'],
  ['pdfjs-dist/build/pdf.worker.min.js', 'pdf.worker.min.js'],
  ['pdf-lib/dist/pdf-lib.min.js', 'pdf-lib.min.js']
];

for (const [source, target] of files) {
  const from = path.join(root, 'node_modules', source);
  const to = path.join(vendor, target);
  if (!fs.existsSync(from)) {
    throw new Error(`PDF dependency missing: ${source}. Run npm install first.`);
  }
  fs.copyFileSync(from, to);
  console.log(`PDF asset ready: /vendor/${target}`);
}
