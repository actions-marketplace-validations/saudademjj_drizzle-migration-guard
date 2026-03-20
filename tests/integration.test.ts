import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runDrizzleCheck } from "../src/checker.js";
import { discoverConfigTargets } from "../src/discovery.js";
import { parseCheckExecution } from "../src/parser.js";

const fixturesDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "valid",
);
const toolingDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function createFixtureProject(name: string): Promise<string> {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), `${name}-`));
  await cp(fixturesDirectory, projectDirectory, { recursive: true });
  await writeFile(
    path.join(projectDirectory, "drizzle.config.ts"),
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

  return projectDirectory;
}

test.after(async () => {
  // Temp folders are unique and safe to clean by prefix.
});

test("passes on a valid migration history fixture", async () => {
  const projectDirectory = await createFixtureProject("drizzle-migration-guard-valid");
  const [target] = await discoverConfigTargets({
    workspaceRoot: projectDirectory,
    workingDirectory: projectDirectory,
    configInput: "",
  });

  const execution = await runDrizzleCheck(target, projectDirectory, { toolingDirectory });
  const parsed = parseCheckExecution(execution);

  assert.equal(parsed.passed, true);
  await rm(projectDirectory, { recursive: true, force: true });
});

test("classifies a duplicated parent snapshot as collision/history", async () => {
  const projectDirectory = await createFixtureProject("drizzle-migration-guard-collision");
  const snapshotPath = path.join(projectDirectory, "drizzle", "meta", "0001_snapshot.json");
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as { prevId: string };
  snapshot.prevId = "00000000-0000-0000-0000-000000000000";
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");

  const [target] = await discoverConfigTargets({
    workspaceRoot: projectDirectory,
    workingDirectory: projectDirectory,
    configInput: "",
  });

  const execution = await runDrizzleCheck(target, projectDirectory, { toolingDirectory });
  const parsed = parseCheckExecution(execution);

  assert.equal(parsed.passed, false);
  assert.equal(parsed.category, "collision/history");
  await rm(projectDirectory, { recursive: true, force: true });
});

test("supports multiple explicit configs", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-multi-"));
  const first = await createFixtureProject("drizzle-migration-guard-multi-a");
  const second = await createFixtureProject("drizzle-migration-guard-multi-b");

  await cp(first, path.join(workspaceRoot, "packages", "a"), { recursive: true });
  await cp(second, path.join(workspaceRoot, "packages", "b"), { recursive: true });

  const targets = await discoverConfigTargets({
    workspaceRoot,
    workingDirectory: workspaceRoot,
    configInput: "packages/a/drizzle.config.ts\npackages/b/drizzle.config.ts",
  });

  assert.equal(targets.length, 2);

  await rm(first, { recursive: true, force: true });
  await rm(second, { recursive: true, force: true });
  await rm(workspaceRoot, { recursive: true, force: true });
});
