import assert from 'node:assert/strict';
import { cp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = new URL(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3165');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'smoke server must be loopback');
const standalone = path.join(root, '.next', 'standalone');
// Match the Docker runner's standalone layout. Only generated build artifacts
// are populated; source assets and production data are never modified.
await cp(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });
await cp(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true });
const child = spawn(process.execPath, [path.join(standalone, 'server.js')], {
  cwd: standalone,
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: target.hostname.replaceAll(/[\[\]]/g, ''), PORT: target.port || '80' },
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error('smoke server could not start:', error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
