import assert from "node:assert/strict";
import test from "node:test";

import { parseCheckExecution } from "../src/parser.js";
import type { CheckExecution, ConfigTarget } from "../src/types.js";

const target: ConfigTarget = {
  configPath: "/tmp/repo/drizzle.config.ts",
  configPathRelative: "drizzle.config.ts",
  configDirectory: "/tmp/repo",
  migrationDirectory: "/tmp/repo/drizzle",
  migrationDirectoryRelative: "drizzle",
  schemaPatterns: ["src/db/schema.ts"],
  relevantPatterns: ["drizzle.config.ts", "drizzle/**", "src/db/schema.ts"],
};

function execution(overrides: Partial<CheckExecution>): CheckExecution {
  return {
    target,
    exitCode: 0,
    stdout: "",
    stderr: "",
    command: "npx --no-install drizzle-kit check --config /tmp/repo/drizzle.config.ts",
    ...overrides,
  };
}

test("parses successful drizzle-kit output", () => {
  const result = parseCheckExecution(
    execution({
      exitCode: 0,
      stdout: "Reading config file '/tmp/repo/drizzle.config.ts'\nEverything's fine 🐶🔥\n",
    }),
  );

  assert.equal(result.passed, true);
  assert.equal(result.category, null);
  assert.equal(result.headline, "Migration history is consistent");
});

test("classifies snapshot collisions as collision/history", () => {
  const result = parseCheckExecution(
    execution({
      exitCode: 1,
      stdout:
        "Reading config file '/tmp/repo/drizzle.config.ts'\n[drizzle/meta/0005_snapshot.json, drizzle/meta/0006_snapshot.json] are pointing to a parent snapshot: drizzle/meta/0005_snapshot.json/snapshot.json which is a collision.\n",
    }),
  );

  assert.equal(result.passed, false);
  assert.equal(result.category, "collision/history");
  assert.match(result.details[0], /collision/i);
});

test("classifies missing dependency errors as config/dependency", () => {
  const result = parseCheckExecution(
    execution({
      exitCode: 1,
      stderr: "npm error npx canceled due to missing packages and no YES option: [\"drizzle-kit@latest\"]",
    }),
  );

  assert.equal(result.passed, false);
  assert.equal(result.category, "config/dependency");
});

test("classifies timeouts as unknown with a timeout headline", () => {
  const result = parseCheckExecution(
    execution({
      exitCode: -1,
      stderr: "drizzle-kit check timed out after 60s.",
      timedOut: true,
      timeoutMs: 60_000,
    }),
  );

  assert.equal(result.passed, false);
  assert.equal(result.category, "unknown");
  assert.match(result.headline, /timed out/i);
});
