import { execSync } from 'child_process';
try {
  const res = execSync('grep -rI "indexOf(" node_modules/firebase/ | grep -v "test" | head -n 30', { encoding: 'utf-8' });
  console.log(res.slice(0, 800));
} catch (e) {}
