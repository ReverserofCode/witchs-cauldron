import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../../../next.config.js');
const { hasLocalMatch } = require('next/dist/shared/lib/match-local-pattern');

describe('withdrawal-safe image configuration', () => {
  it('rejects managed images from the persistent optimizer cache', () => {
    expect(hasLocalMatch(config.images.localPatterns, '/media/fanart/123')).toBe(false);
  });
  it('preserves the existing static image directories', () => {
    for (const directory of ['mainPage', 'rightAside', 'gnbIcon', 'logos', 'assets']) {
      expect(hasLocalMatch(config.images.localPatterns, `/${directory}/example.png`)).toBe(true);
    }
  });
});
