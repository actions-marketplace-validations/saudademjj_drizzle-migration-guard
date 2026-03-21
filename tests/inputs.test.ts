import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  assertWorkingDirectory,
  parseCommentMode,
  parseFailOnMode,
  parseTimeoutSeconds,
} from "../src/inputs.js";

test("parses valid fail-on values", () => {
  assert.equal(parseFailOnMode("collision"), "collision");
  assert.equal(parseFailOnMode("all"), "all");
  assert.equal(parseFailOnMode("none"), "none");
  assert.equal(parseFailOnMode(""), "collision");
});

test("rejects invalid fail-on values", () => {
  assert.throws(() => parseFailOnMode("typo"));
});

test("parses valid comment modes", () => {
  assert.equal(parseCommentMode("sticky"), "sticky");
  assert.equal(parseCommentMode("off"), "off");
  assert.equal(parseCommentMode(""), "sticky");
});

test("rejects invalid comment modes", () => {
  assert.throws(() => parseCommentMode("invalid"));
});

test("parses timeout seconds with defaults and validation", () => {
  assert.equal(parseTimeoutSeconds(""), 60);
  assert.equal(parseTimeoutSeconds("30"), 30);
  assert.throws(() => parseTimeoutSeconds("0"));
  assert.throws(() => parseTimeoutSeconds("-1"));
  assert.throws(() => parseTimeoutSeconds("foo"));
});

test("assertWorkingDirectory rejects escapes outside workspace", () => {
  const workspaceRoot = path.join(path.sep, "repo");
  assert.doesNotThrow(() => assertWorkingDirectory(workspaceRoot, path.join(workspaceRoot, "apps")));
  assert.throws(() => assertWorkingDirectory(workspaceRoot, path.join(path.sep, "outside")));
  assert.throws(() => assertWorkingDirectory(workspaceRoot, path.join(workspaceRoot, "..", "outside")));
});
