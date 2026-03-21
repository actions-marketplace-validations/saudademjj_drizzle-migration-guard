import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverConfigTargets, findMatchedFiles, hydrateConfigTarget } from "../src/discovery.js";

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
    resolveConfigExports: true,
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

test("treats package-local manifests as relevant changes for monorepo configs", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-manifest-"));
  const packageRoot = path.join(workspaceRoot, "packages", "api");
  await mkdir(path.join(packageRoot, "src", "db"), { recursive: true });

  await writeFile(
    path.join(packageRoot, "drizzle.config.ts"),
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
    workingDirectory: packageRoot,
    configInput: "",
  });

  const matches = findMatchedFiles(target, [
    "packages/api/package.json",
    "packages/api/package-lock.json",
    "packages/api/pnpm-lock.yaml",
    "packages/web/package.json",
  ]);

  assert.deepEqual(matches, [
    "packages/api/package.json",
    "packages/api/package-lock.json",
    "packages/api/pnpm-lock.yaml",
  ]);
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
    resolveConfigExports: true,
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

test("marks dynamic config fields for lazy hydration before execution", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-lazy-mark-"));
  const packageRoot = path.join(workspaceRoot, "packages", "api");
  await mkdir(path.join(packageRoot, "src", "db"), { recursive: true });

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
      "};",
      "",
    ].join("\n"),
    "utf8",
  );

  const [target] = await discoverConfigTargets({
    workspaceRoot,
    workingDirectory: packageRoot,
    configInput: "",
  });

  assert.equal(target.needsDynamicResolution, true);
  assert.equal(target.migrationDirectoryRelative, "packages/api/drizzle");
  assert.deepEqual(target.schemaPatterns, []);

  const hydrated = await hydrateConfigTarget(target, workspaceRoot);
  assert.equal(hydrated.needsDynamicResolution, false);
  assert.equal(hydrated.migrationDirectoryRelative, "packages/api/custom-migrations");
  assert.deepEqual(hydrated.schemaPatterns, ["packages/api/src/db/schema.ts"]);

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

test("does not eagerly execute config exports during discovery", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-no-eager-load-"));

  await writeFile(
    path.join(workspaceRoot, "drizzle.config.ts"),
    [
      "export default new Promise(() => {});",
      "",
    ].join("\n"),
    "utf8",
  );

  const targets = await Promise.race([
    discoverConfigTargets({
      workspaceRoot,
      workingDirectory: workspaceRoot,
      configInput: "",
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("discovery timed out")), 250);
    }),
  ]);

  assert.equal(targets.length, 1);
  assert.equal(targets[0].migrationDirectoryRelative, "drizzle");
  assert.equal(targets[0].needsDynamicResolution, false);
});

test("lazy hydration times out safely for hanging dynamic config exports", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "drizzle-migration-guard-lazy-timeout-"));

  await writeFile(
    path.join(workspaceRoot, "drizzle.config.ts"),
    [
      "export default async () => {",
      "  const config = {",
      "    out: `${process.env.DMG_OUT_DIR}` ,",
      "  };",
      "  return new Promise(() => {});",
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

  assert.equal(target.needsDynamicResolution, true);

  const hydrated = await Promise.race([
    hydrateConfigTarget(target, workspaceRoot, { timeoutMs: 100 }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("lazy hydration timed out")), 400);
    }),
  ]);

  assert.equal(hydrated.needsDynamicResolution, false);
  assert.equal(hydrated.migrationDirectoryRelative, "drizzle");
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
