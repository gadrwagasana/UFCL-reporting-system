const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const envExample = path.join(root, '.env.example');
const envFile = path.join(root, '.env');

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(envExample)) {
  fail('.env.example is missing. Create one from the project template.');
}

if (!fs.existsSync(envFile)) {
  fs.copyFileSync(envExample, envFile);
  console.log('Created .env from .env.example. Please review and update credentials if needed.');
} else {
  console.log('.env already exists. Using existing environment configuration.');
}

console.log('Installing dependencies...');
let result = spawnSync('npm', ['install'], { cwd: root, stdio: 'inherit', shell: true });
if (result.status !== 0) {
  fail('npm install failed.');
}

console.log('Running database migration...');
result = spawnSync('npm', ['run', 'migrate'], { cwd: root, stdio: 'inherit', shell: true });
if (result.status !== 0) {
  fail('npm run migrate failed.');
}

console.log('\nSetup complete!');
console.log('Run `npm start` to launch the desktop application.');
