import * as core from "@actions/core";
import path from "node:path";

import { runDrizzleCheck } from "./checker.js";
import { discoverConfigTargets, findMatchedFiles } from "./discovery.js";
import { getPullRequestChangedFiles, hasPullRequestContext, syncStickyComment } from "./github.js";
import { parseCheckExecution } from "./parser.js";
import {
  buildOverallSummary,
  COMMENT_MARKER,
  deriveOverallStatus,
  isBlockingFailure,
  renderCommentMarkdown,
  renderReportMarkdown,
  writeMarkdownReport,
} from "./reporters.js";
import type {
  CommentMode,
  FailOnMode,
  GuardInputs,
  GuardResult,
} from "./types.js";

function parseFailOnMode(raw: string): FailOnMode {
  if (raw === "all" || raw === "none") {
    return raw;
  }

  return "collision";
}

function parseCommentMode(raw: string): CommentMode {
  return raw === "off" ? "off" : "sticky";
}

function resolveInputs(): GuardInputs {
  const workspaceRoot = path.resolve(process.env.GITHUB_WORKSPACE ?? process.cwd());
  const workingDirectoryInput = core.getInput("working-directory") || ".";
  const workingDirectory = path.resolve(workspaceRoot, workingDirectoryInput);

  return {
    workspaceRoot,
    workingDirectory,
    configInput: core.getInput("config"),
    failOn: parseFailOnMode(core.getInput("fail-on")),
    commentMode: parseCommentMode(core.getInput("comment-mode")),
    githubToken: core.getInput("github-token"),
  };
}

function buildSkippedResult(target: GuardResult["target"], matchedFiles: string[]): GuardResult {
  return {
    target,
    status: "skipped",
    category: null,
    blocking: false,
    summary: "No relevant Drizzle files changed for this config.",
    details: ["The pull request did not touch this config, its schema files, or its migration directory."],
    stdout: "",
    stderr: "",
    exitCode: null,
    command: null,
    matchedFiles,
  };
}

function publishAnnotations(results: GuardResult[]): void {
  for (const result of results) {
    if (result.status === "success") {
      core.info(`[${result.target.configPathRelative}] ${result.summary}`);
      continue;
    }

    if (result.status === "skipped") {
      core.info(`[${result.target.configPathRelative}] ${result.summary}`);
      continue;
    }

    const message = [
      result.summary,
      ...result.details.slice(0, 3),
      `Command: ${result.command ?? "n/a"}`,
    ].join("\n");

    if (result.blocking) {
      core.error(message);
    } else {
      core.warning(message);
    }
  }
}

async function run(): Promise<void> {
  const inputs = resolveInputs();

  core.startGroup("Discover Drizzle configs");
  const targets = await discoverConfigTargets({
    workspaceRoot: inputs.workspaceRoot,
    workingDirectory: inputs.workingDirectory,
    configInput: inputs.configInput,
  });
  targets.forEach((target) => {
    core.info(
      `Found ${target.configPathRelative} with migration directory ${target.migrationDirectoryRelative}`,
    );
  });
  core.endGroup();

  let changedFiles: string[] | null = null;
  if (hasPullRequestContext() && inputs.githubToken) {
    core.startGroup("Read pull request files");
    changedFiles = await getPullRequestChangedFiles(inputs.githubToken);
    core.info(`Loaded ${changedFiles?.length ?? 0} changed file(s) from the pull request.`);
    core.endGroup();
  } else if (hasPullRequestContext()) {
    core.warning("github-token was not provided, so drizzle-migration-guard will check every config.");
  }

  const results: GuardResult[] = [];

  for (const target of targets) {
    const matchedFiles = changedFiles ? findMatchedFiles(target, changedFiles) : [];
    const shouldSkip = changedFiles !== null && matchedFiles.length === 0;

    if (shouldSkip) {
      results.push(buildSkippedResult(target, matchedFiles));
      continue;
    }

    core.startGroup(`Run drizzle-kit check for ${target.configPathRelative}`);
    const execution = await runDrizzleCheck(target, inputs.workingDirectory);
    const parsed = parseCheckExecution(execution);
    core.info(parsed.headline);
    core.endGroup();

    results.push({
      target,
      status: parsed.passed ? "success" : "failed",
      category: parsed.category,
      blocking: isBlockingFailure(parsed.category, inputs.failOn),
      summary: parsed.headline,
      details: parsed.details,
      stdout: execution.stdout.trim(),
      stderr: execution.stderr.trim(),
      exitCode: execution.exitCode,
      command: execution.command,
      matchedFiles,
    });
  }

  publishAnnotations(results);

  const overallStatus = deriveOverallStatus(results);
  const summary = buildOverallSummary(results, overallStatus);
  const markdown = renderReportMarkdown(summary, results, overallStatus);
  const reportPath = await writeMarkdownReport(markdown);

  await core.summary.addRaw(markdown).write();

  core.setOutput("status", overallStatus);
  core.setOutput("summary", summary);
  core.setOutput("report-path", reportPath);

  const hasFailures = results.some((result) => result.status === "failed");
  if (
    inputs.commentMode === "sticky" &&
    inputs.githubToken &&
    hasPullRequestContext()
  ) {
    const commentBody = renderCommentMarkdown({
      status: overallStatus,
      summary,
      results,
      markdown,
      reportPath,
    });
    await syncStickyComment({
      githubToken: inputs.githubToken,
      body: commentBody,
      marker: COMMENT_MARKER,
      allowCreate: hasFailures,
    });
  }

  if (overallStatus === "failure") {
    core.setFailed(summary);
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
});
