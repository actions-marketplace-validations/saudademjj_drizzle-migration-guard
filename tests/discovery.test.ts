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

test("loads dynamic config exports and ignores commented schema", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-dynamic-"));
  const packageRoot = path.join(workspaceRoot, "packages", "api");
  await mkdir(path.join(packageRoot, "src", "db"), { recursive: true });
  await mkdir(path.join(packageRoot, "custom-migrations"), { recursive: true });

  const previousSchemaDir = process.env.DMG_SCHEMA_DIR;
  const previousOutDir = process.env.DMG_OUT_DIR;
  process.env.DMG_SCHEMA_DIR = "./src/db";
  process.env.DMG_OUT_DIR = "./custom-migrations";

  await writeFile(
    path.join(packageRoot, "drizzle.config.ts"),
    [
      "export default {",
      "  schema: `${process.env.DMG_SCHEMA_DIR}/schema.ts`,",
      "  out: `${process.env.DMG_OUT_DIR}`,",
      "  dialect: 'postgresql',",
      "  // schema: './old-schema.ts'",
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
  assert.equal(targets[0].migrationDirectoryRelative, "packages/api/custom-migrations");
  assert.deepEqual(targets[0].schemaPatterns, ["packages/api/src/db/schema.ts"]);

  if (previousSchemaDir === undefined) {
    delete process.env.DMG_SCHEMA_DIR;
  } else {
    process.env.DMG_SCHEMA_DIR = previousSchemaDir;
  }

  if (previousOutDir === undefined) {
    delete process.env.DMG_OUT_DIR;
  } else {
    process.env.DMG_OUT_DIR = previousOutDir;
  }
});

test("expands glob config inputs for monorepos", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-glob-"));
  const packagesRoot = path.join(workspaceRoot, "packages");
  await mkdir(path.join(packagesRoot, "a", "src", "db"), { recursive: true });
  await mkdir(path.join(packagesRoot, "b", "src", "db"), { recursive: true });

  const configContent = [
    "export default {",
    "  schema: './src/db/schema.ts',",
    "  out: './drizzle',",
    "  dialect: 'postgresql',",
    "};",
    "",
  ].join("\n");

  await writeFile(path.join(packagesRoot, "a", "drizzle.config.ts"), configContent, "utf8");
  await writeFile(path.join(packagesRoot, "b", "drizzle.config.ts"), configContent, "utf8");

  const targets = await discoverConfigTargets({
    workspaceRoot,
    workingDirectory: workspaceRoot,
    configInput: "packages/*/drizzle.config.ts",
  });

  assert.equal(targets.length, 2);
});

test("throws when explicit config paths do not exist", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-missing-"));
  await assert.rejects(
    discoverConfigTargets({
      workspaceRoot,
      workingDirectory: workspaceRoot,
      configInput: "drizzle.config.ts",
    }),
  );
});

test("throws when glob config input matches nothing", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-glob-miss-"));
  await assert.rejects(
    discoverConfigTargets({
      workspaceRoot,
      workingDirectory: workspaceRoot,
      configInput: "packages/*/drizzle.config.ts",
    }),
  );
});

test("supports configs without schema entries", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-noschema-"));

  await writeFile(
    path.join(workspaceRoot, "drizzle.config.ts"),
    [
      "export default {",
      "  out: './drizzle',",
      "  dialect: 'postgresql',",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );

  const targets = await discoverConfigTargets({
    workspaceRoot,
    workingDirectory: workspaceRoot,
    configInput: "",
  });

  assert.equal(targets.length, 1);
  assert.deepEqual(targets[0].schemaPatterns, []);
  assert.equal(targets[0].migrationDirectoryRelative, "drizzle");
});
