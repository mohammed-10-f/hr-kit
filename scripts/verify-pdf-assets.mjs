import fs from 'node:fs';
import path from 'node:path';
const files = ['pdf.min.js','pdf.worker.min.js','pdf-lib.min.js'];
const missing = files.filter(f => !fs.existsSync(path.join(process.cwd(),'public','vendor',f)));
if (missing.length) {
  console.error('Missing local PDF assets:', missing.join(', '));
  process.exit(1);
}
console.log('Local PDF engine: OK');
