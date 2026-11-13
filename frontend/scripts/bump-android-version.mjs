// Bumps the Android version in android/version.properties.
//   npm run android:version            -> versionCode +1, patch +1 (1.0.0 -> 1.0.1)
//   npm run android:version -- 1.2.0   -> versionCode +1, versionName 1.2.0
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../android/version.properties', import.meta.url);
let text = readFileSync(file, 'utf8');
const code = Number(/^versionCode=(\d+)/m.exec(text)[1]) + 1;
const current = /^versionName=(.+)$/m.exec(text)[1].trim();
const [maj, min, patch] = current.split('.').map(Number);
const name = process.argv[2] || `${maj}.${min}.${(patch || 0) + 1}`;
if (!/^\d+\.\d+\.\d+$/.test(name)) throw new Error(`Version must look like 1.2.3, got "${name}"`);
text = text.replace(/^versionCode=.*$/m, `versionCode=${code}`).replace(/^versionName=.*$/m, `versionName=${name}`);
writeFileSync(file, text);

const pkgFile = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
pkg.version = name; // shown in Settings
writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Android version is now ${name} (versionCode ${code}). Next: npm run android:release`);
