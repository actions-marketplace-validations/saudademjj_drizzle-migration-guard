import { spawn } from "node:child_process";
import path from "node:path";

import fg from "fast-glob";

const patterns = ["tests/**/*.test.ts"];
const files = await fg(patterns, {
  absolute: true,
  dot: true,
  cwd: process.cwd(),
});

if (files.length === 0) {
  console.error("No test files found. Check test patterns or repository layout.");
  process.exit(1);
}

const nodeArgs = ["--import", "tsx", "--test", ...files];
const child = spawn(process.execPath, nodeArgs, {
  stdio: "inherit",
  cwd: process.cwd(),
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
