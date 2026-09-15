import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/lib/**/*.test.ts", "app/api/**/*.test.ts"],
  },
});
