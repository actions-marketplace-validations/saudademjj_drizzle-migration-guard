import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function createFixtureProject(prefix: string): Promise<{
  repoRoot: string;
  tempRoot: string;
  relativeWorkingDirectory: string;
  summaryPath: string;
  outputPath: string;
  eventPath: string;
}> {
  const root = repoRoot();
  const fixturesDirectory = path.join(root, "tests", "fixtures", "valid");
  const tempRoot = await mkdtemp(path.join(root, prefix));
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

  return {
    repoRoot: root,
    tempRoot,
    relativeWorkingDirectory: path.relative(root, tempRoot),
    summaryPath,
    outputPath,
    eventPath,
  };
}

test("index flow succeeds with explicit config input", async () => {
  const { repoRoot: root, tempRoot, relativeWorkingDirectory, summaryPath, outputPath, eventPath } =
    await createFixtureProject(".tmp-drizzle-migration-guard-e2e-");
  try {
    const env = {
      ...process.env,
      GITHUB_WORKSPACE: root,
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_STEP_SUMMARY: summaryPath,
      GITHUB_OUTPUT: outputPath,
      INPUT_CONFIG: "drizzle.config.ts",
    };
    env["INPUT_WORKING-DIRECTORY"] = relativeWorkingDirectory;
    env["INPUT_FAIL-ON"] = "";

    const result = await execFileAsync(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: root,
      env,
    });

    assert.match(result.stdout, /Migration history is consistent/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("index flow fails and reports collisions when fail-on blocks", async () => {
  const { repoRoot: root, tempRoot, relativeWorkingDirectory, summaryPath, outputPath, eventPath } =
    await createFixtureProject(".tmp-drizzle-migration-guard-e2e-fail-");
  try {
    const snapshotPath = path.join(tempRoot, "drizzle", "meta", "0001_snapshot.json");
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as { prevId: string };
    snapshot.prevId = "00000000-0000-0000-0000-000000000000";
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");

    const env = {
      ...process.env,
      GITHUB_WORKSPACE: root,
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_STEP_SUMMARY: summaryPath,
      GITHUB_OUTPUT: outputPath,
      INPUT_CONFIG: "drizzle.config.ts",
    };
    env["INPUT_WORKING-DIRECTORY"] = relativeWorkingDirectory;
    env["INPUT_FAIL-ON"] = "collision";

    await assert.rejects(
      execFileAsync(process.execPath, ["--import", "tsx", "src/index.ts"], {
        cwd: root,
        env,
      }),
      (error: unknown) => {
        assert.ok(error && typeof error === "object");
        const output = [
          "stdout" in error && typeof error.stdout === "string" ? error.stdout : "",
          "stderr" in error && typeof error.stderr === "string" ? error.stderr : "",
        ].join("\n");
        assert.match(output, /blocking failure|collision/i);
        return true;
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
