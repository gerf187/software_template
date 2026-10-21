import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

// Eigene Test-Dateien in __vitest__ statt __tests__ (Abschnitt 5/8): die
// bestehenden __tests__-Dateien laufen über node --test (test-runner.mjs)
// und verstehen import.meta.glob nicht -- Vitest braucht dafür Vites echte
// Bundler-Transformation, deshalb hier getrennt.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["src/**/__vitest__/**/*.test.js"],
    },
  })
);
