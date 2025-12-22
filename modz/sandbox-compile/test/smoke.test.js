const fs = require('fs');
const path = require('path');
const required = [
  'services/clsi/app.js',
  'services/web/modules/server-ce-scripts/scripts/check-texlive-images.mjs'
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
