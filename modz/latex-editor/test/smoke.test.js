const fs = require('fs');
const path = require('path');
const required = [
  'services/web/modules/latex-editor/index.mjs',
  'services/web/package.json'
].map(p => path.join(__dirname, '..', p));
let missing = [];
for (const f of required) {
  if (!fs.existsSync(f)) missing.push(f);
}
if (missing.length) {
  console.error('Missing required files:');
  missing.forEach(m => console.error('  ' + m));
  process.exit(2);
}
console.log('Smoke test passed: key files exist');
