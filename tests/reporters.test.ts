import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOverallSummary,
  deriveOverallStatus,
  renderCommentMarkdown,
  renderReportMarkdown,
} from "../src/reporters.js";
import type { ActionReport, ConfigTarget, GuardResult } from "../src/types.js";

const target: ConfigTarget = {
  configPath: "/tmp/repo/drizzle.config.ts",
  configPathRelative: "drizzle.config.ts",
  configDirectory: "/tmp/repo",
  migrationDirectory: "/tmp/repo/drizzle",
  migrationDirectoryRelative: "drizzle",
  schemaPatterns: ["src/db/schema.ts"],
  relevantPatterns: ["drizzle.config.ts", "drizzle/**", "src/db/schema.ts"],
};

function result(overrides: Partial<GuardResult>): GuardResult {
  return {
    target,
    status: "success",
    category: null,
    blocking: false,
    summary: "Migration history is consistent",
    details: [],
    stdout: "",
    stderr: "",
    exitCode: 0,
    command: "npx --no-install drizzle-kit check --config /tmp/repo/drizzle.config.ts",
    matchedFiles: ["src/db/schema.ts"],
    ...overrides,
  };
}

test("builds a readable overall summary and markdown report", () => {
  const results = [
    result({ status: "success" }),
    result({
      status: "failed",
      category: "collision/history",
      blocking: true,
      summary: "Drizzle reported a migration history collision",
      details: ["collision detected"],
      stdout: "[drizzle/meta/0000_snapshot.json, drizzle/meta/0001_snapshot.json] are pointing to a parent snapshot: drizzle/meta/0000_snapshot.json/snapshot.json which is a collision.",
      exitCode: 1,
    }),
  ];

  const overallStatus = deriveOverallStatus(results);
  const summary = buildOverallSummary(results, overallStatus);
  const markdown = renderReportMarkdown(summary, results, overallStatus);

  assert.equal(overallStatus, "failure");
  assert.match(summary, /blocking failure/i);
  assert.match(markdown, /How to fix:/);
  assert.match(markdown, /drizzle-kit generate/);
});

test("renders sticky PR comments for failing checks", () => {
  const report: ActionReport = {
    status: "failure",
    summary: "drizzle-migration-guard finished with 0 checks passed, 1 blocking failure, 0 warning results, 0 checks skipped.",
    results: [
      result({
        status: "failed",
        category: "collision/history",
        blocking: true,
        summary: "Drizzle reported a migration history collision",
        details: ["collision detected"],
        stdout: "collision",
        exitCode: 1,
      }),
    ],
    markdown: "",
    reportPath: "/tmp/report.md",
  };

  const markdown = renderCommentMarkdown(report);
  assert.match(markdown, /drizzle-migration-guard/);
  assert.match(markdown, /Pull the latest default branch/);
});

