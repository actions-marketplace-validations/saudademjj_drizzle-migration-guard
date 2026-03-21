import { spawnSync } from "node:child_process";

const result = spawnSync(
  "git",
  ["diff", "--quiet", "--exit-code", "--", "dist/index.js", "dist/index.js.map"],
  {
    cwd: process.cwd(),
    stdio: "inherit",
  },
);

if (result.status === 0) {
  process.exit(0);
}

if (result.status === null) {
  console.error("Failed to verify dist output because git did not complete.");
  process.exit(1);
}

console.error(
  "Committed dist artifacts are out of date. Run `npm run build` and commit the updated dist files.",
);
process.exit(result.status);
