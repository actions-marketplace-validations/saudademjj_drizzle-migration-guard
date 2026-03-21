import assert from "node:assert/strict";
import test from "node:test";

import { matchesRelevantPattern, normalizeFileList, toPosixPath } from "../src/utils.js";

test("normalizes Windows-style paths to posix", () => {
  assert.equal(toPosixPath("src\\db\\schema.ts"), "src/db/schema.ts");
});

test("normalizeFileList strips leading slashes and backslashes", () => {
  const normalized = normalizeFileList([
    "\\\\src\\\\db\\\\schema.ts",
    "/drizzle/0001.sql",
    "drizzle\\\\0002.sql",
    "",
  ]);

  assert.deepEqual(normalized, [
    "src/db/schema.ts",
    "drizzle/0001.sql",
    "drizzle/0002.sql",
  ]);
});

test("matchesRelevantPattern handles directory globs", () => {
  assert.equal(matchesRelevantPattern("drizzle/0001.sql", "drizzle/**"), true);
  assert.equal(matchesRelevantPattern("other/0001.sql", "drizzle/**"), false);
});
