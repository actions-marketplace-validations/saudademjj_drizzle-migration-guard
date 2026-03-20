import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverConfigTargets, findMatchedFiles } from "../src/discovery.js";

test("discovers default drizzle config and parses schema plus out paths", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-discovery-"));
  const packageRoot = path.join(workspaceRoot, "packages", "api");
  await mkdir(path.join(packageRoot, "src", "db"), { recursive: true });
  await mkdir(path.join(packageRoot, "migrations"), { recursive: true });

  await writeFile(
    path.join(packageRoot, "drizzle.config.ts"),
    [
      "export default {",
      "  schema: ['./src/db/schema.ts', './src/db/extra.ts'],",
      "  out: './migrations',",
      "  dialect: 'postgresql',",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );

  const targets = await discoverConfigTargets({
    workspaceRoot,
    workingDirectory: packageRoot,
    configInput: "",
  });

  assert.equal(targets.length, 1);
  assert.equal(targets[0].configPathRelative, "packages/api/drizzle.config.ts");
  assert.equal(targets[0].migrationDirectoryRelative, "packages/api/migrations");
  assert.deepEqual(targets[0].schemaPatterns, [
    "packages/api/src/db/schema.ts",
    "packages/api/src/db/extra.ts",
  ]);
});

test("matches changed files against config, schema, and migration patterns", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-match-"));
  await mkdir(path.join(workspaceRoot, "src", "db"), { recursive: true });

  await writeFile(
    path.join(workspaceRoot, "drizzle.config.ts"),
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

  const [target] = await discoverConfigTargets({
    workspaceRoot,
    workingDirectory: workspaceRoot,
    configInput: "",
  });

  const matches = findMatchedFiles(target, [
    "README.md",
    "src/db/schema.ts",
    "drizzle/0003_add_indexes.sql",
  ]);

  assert.deepEqual(matches, ["src/db/schema.ts", "drizzle/0003_add_indexes.sql"]);
});

