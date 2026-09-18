import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, after } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'fanart-compose-'));
const emptyEnv = join(directory, 'empty.env');
writeFileSync(emptyEnv, '# Isolated interpolation fixture; never load operator .env files.\n');
after(() => { unlinkSync(emptyEnv); rmdirSync(directory); });

const cases = [
  { name: 'bundled database', fanart: '', analytics: '', expected: 'postgres://analytics:analytics@analytics-db:5432/analytics' },
  { name: 'analytics override', fanart: '', analytics: 'postgres://fixture:fixture@analytics-custom:5432/catalog', expected: 'postgres://fixture:fixture@analytics-custom:5432/catalog' },
  { name: 'fanart override wins', fanart: 'postgres://fixture:fixture@fanart-custom:5432/catalog', analytics: 'postgres://fixture:fixture@analytics-custom:5432/catalog', expected: 'postgres://fixture:fixture@fanart-custom:5432/catalog' },
];

for (const file of ['docker-compose.yml', 'docker-compose.prod.yml', 'docker-compose.server.yml']) {
  for (const scenario of cases) {
    test(`${file}: ${scenario.name} supplies a usable explicit connection`, () => {
      const output = execFileSync('docker', ['compose', '--env-file', emptyEnv, '-f', file, 'config', '--format', 'json'], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, FANART_DATABASE_URL: scenario.fanart, ANALYTICS_DATABASE_URL: scenario.analytics },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const config = JSON.parse(output);
      const env = config.services.frontend.environment;
      assert.equal(env.FANART_DATABASE_URL || env.ANALYTICS_DATABASE_URL, scenario.expected);
      assert.equal(env.FANART_ASSETS_DIR, '/app/data/fanart');
      assert.ok(config.services.frontend.volumes.some(volume => volume.source === 'fanart_assets' && volume.target === '/app/data/fanart' && !volume.read_only));
    });
  }
}
