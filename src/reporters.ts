import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  ActionReport,
  FailureCategory,
  FailOnMode,
  GuardResult,
  OverallStatus,
} from "./types.js";
import { pluralize, shorten } from "./utils.js";

export const COMMENT_MARKER = "<!-- drizzle-migration-guard -->";

export function isBlockingFailure(category: FailureCategory | null, failOn: FailOnMode): boolean {
  if (category === null || failOn === "none") {
    return false;
  }

  if (failOn === "all") {
    return true;
  }

  return category === "collision/history";
}

function renderStatusBadge(result: GuardResult): string {
  if (result.status === "success") {
    return "PASS";
  }

  if (result.status === "skipped") {
    return "SKIP";
  }

  return result.blocking ? "FAIL" : "WARN";
}

function renderCategoryLabel(category: FailureCategory | null): string {
  return category ?? "-";
}

function buildFixRecipe(category: FailureCategory | null, configPath: string): string[] {
  switch (category) {
    case "collision/history":
      return [
        "Pull the latest default branch and rebase or merge it into your PR branch.",
        `Re-run \`npx drizzle-kit generate --config ${configPath}\` so Drizzle rebuilds the migration chain on top of the latest snapshots.`,
        "Push the regenerated migration and let the action re-check the branch.",
      ];
    case "config/dependency":
      return [
        "Make sure project dependencies are installed before this action runs.",
        `Run \`npx drizzle-kit check --config ${configPath}\` locally to confirm the config file resolves cleanly.`,
        "If the config imports TypeScript helpers, verify the files exist in CI and the working-directory input points at the right package.",
      ];
    case "unknown":
      return [
        `Run \`npx drizzle-kit check --config ${configPath}\` locally and compare the raw output with the CI log.`,
        "If this is a repeatable drizzle-kit edge case, keep the raw output in the PR and tighten the parser in a follow-up release.",
      ];
    default:
      return ["No action needed."];
  }
}

export function deriveOverallStatus(results: GuardResult[]): OverallStatus {
  if (results.some((result) => result.status === "failed" && result.blocking)) {
    return "failure";
  }

  if (results.every((result) => result.status === "skipped")) {
    return "skipped";
  }

  return "success";
}

export function buildOverallSummary(results: GuardResult[], overallStatus: OverallStatus): string {
  const passed = results.filter((result) => result.status === "success").length;
  const failed = results.filter((result) => result.status === "failed" && result.blocking).length;
  const warned = results.filter((result) => result.status === "failed" && !result.blocking).length;
  const skipped = results.filter((result) => result.status === "skipped").length;

  if (overallStatus === "skipped") {
    return "Skipped drizzle-migration-guard because the pull request did not touch Drizzle config, schema, or migration files.";
  }

  const parts = [
    `${passed} ${pluralize(passed, "check")} passed`,
    `${failed} blocking ${pluralize(failed, "failure")}`,
    `${warned} warning ${pluralize(warned, "result")}`,
    `${skipped} ${pluralize(skipped, "check")} skipped`,
  ];

  return `drizzle-migration-guard finished with ${parts.join(", ")}.`;
}

function renderTable(results: GuardResult[]): string {
  const rows = results.map((result) => {
    return `| ${renderStatusBadge(result)} | \`${result.target.configPathRelative}\` | \`${renderCategoryLabel(
      result.category,
    )}\` | ${shorten(result.summary, 80)} |`;
  });

  return [
    "| Status | Config | Category | Summary |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function renderResultSection(result: GuardResult): string {
  const lines = [`### \`${result.target.configPathRelative}\``];

  lines.push(`- Status: ${renderStatusBadge(result)}`);
  lines.push(`- Category: \`${renderCategoryLabel(result.category)}\``);
  lines.push(`- Migration directory: \`${result.target.migrationDirectoryRelative}\``);

  if (result.matchedFiles.length > 0) {
    lines.push(`- Matched files: ${result.matchedFiles.map((file) => `\`${file}\``).join(", ")}`);
  }

  if (result.status === "failed") {
    lines.push(`- Headline: ${result.summary}`);
    lines.push("");
    lines.push("How to fix:");
    for (const step of buildFixRecipe(result.category, result.target.configPathRelative)) {
      lines.push(`- ${step}`);
    }

    const outputBlock = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();

    if (outputBlock) {
      lines.push("");
      lines.push("Raw output:");
      lines.push("```text");
      lines.push(outputBlock);
      lines.push("```");
    }
  } else if (result.status === "skipped") {
    lines.push(`- Reason: ${result.summary}`);
  }

  return lines.join("\n");
}

export function renderReportMarkdown(summary: string, results: GuardResult[], overallStatus: OverallStatus): string {
  const lines = ["# drizzle-migration-guard", "", summary, ""];

  if (results.length > 0) {
    lines.push(renderTable(results), "");
    for (const result of results) {
      lines.push(renderResultSection(result), "");
    }
  }

  if (overallStatus === "success") {
    lines.push("The action did not find a blocking migration collision.");
  } else if (overallStatus === "failure") {
    lines.push("A blocking Drizzle migration collision needs attention before merge.");
  } else {
    lines.push("Nothing relevant changed for Drizzle, so the action stayed quiet.");
  }

  return lines.join("\n").trim();
}

export function renderCommentMarkdown(report: ActionReport): string {
  const lines = [COMMENT_MARKER, "## drizzle-migration-guard", "", report.summary, ""];

  const failedResults = report.results.filter((result) => result.status === "failed");
  const skippedOnly = report.results.every((result) => result.status === "skipped");

  if (skippedOnly) {
    lines.push("No PR comment was needed because this pull request did not touch Drizzle files.");
    return lines.join("\n");
  }

  if (failedResults.length === 0) {
    lines.push("Current status: no blocking migration collision is left on this PR.");
    return lines.join("\n");
  }

  lines.push(renderTable(failedResults), "");

  for (const result of failedResults) {
    lines.push(`### ${result.summary}`, "");
    for (const step of buildFixRecipe(result.category, result.target.configPathRelative)) {
      lines.push(`- ${step}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export async function writeMarkdownReport(markdown: string): Promise<string> {
  const baseDirectory = process.env.RUNNER_TEMP ?? os.tmpdir();
  const reportDirectory = await mkdtemp(path.join(baseDirectory, "drizzle-migration-guard-"));
  const reportPath = path.join(reportDirectory, "report.md");
  await writeFile(reportPath, markdown, "utf8");
  return reportPath;
}

