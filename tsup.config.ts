import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node20",
  platform: "node",
  sourcemap: true,
  clean: true,
  outDir: "dist",
  noExternal: [
    "@actions/core",
    "@actions/exec",
    "@actions/github",
    "fast-glob",
    "jiti",
    "minimatch",
  ],
});
