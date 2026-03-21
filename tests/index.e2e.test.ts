import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

test("index flow succeeds with explicit config input", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const fixturesDirectory = path.join(repoRoot, "tests", "fixtures", "valid");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-e2e-"));
  const summaryPath = path.join(tempRoot, "summary.md");
  const outputPath = path.join(tempRoot, "output.txt");
  const eventPath = path.join(tempRoot, "event.json");

  await cp(fixturesDirectory, tempRoot, { recursive: true });
  await writeFile(
    path.join(tempRoot, "drizzle.config.ts"),
    [
      "export default {",
      "  schema: './src/db/schema.ts',",
      "  out: './drizzle',",
      "  dialect: 'postgresql',",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(eventPath, JSON.stringify({ pull_request: { number: 123 } }, null, 2), "utf8");
  await writeFile(summaryPath, "", "utf8");
  await writeFile(outputPath, "", "utf8");

  const env = {
    ...process.env,
    GITHUB_WORKSPACE: repoRoot,
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_STEP_SUMMARY: summaryPath,
    GITHUB_OUTPUT: outputPath,
    INPUT_CONFIG: path.join(tempRoot, "drizzle.config.ts"),
  };
  env["INPUT_WORKING-DIRECTORY"] = ".";

  const result = await execFileAsync(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: repoRoot,
    env,
  });

  assert.match(result.stdout, /Migration history is consistent/);

  await rm(tempRoot, { recursive: true, force: true });
});
