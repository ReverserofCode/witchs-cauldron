import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["scripts/fanart-browser/provider.test.ts"], testTimeout: 15000 } });
