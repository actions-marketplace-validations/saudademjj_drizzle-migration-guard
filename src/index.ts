import * as core from "@actions/core";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { runDrizzleCheck } from "./checker.js";
import { discoverConfigTargets, findMatchedFiles, hydrateConfigTarget } from "./discovery.js";
import { getPullRequestChangedFiles, hasPullRequestContext, syncStickyComment } from "./github.js";
import { assertWorkingDirectory, parseCommentMode, parseFailOnMode, parseTimeoutSeconds } from "./inputs.js";
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
import type { ConfigTarget, GuardInputs, GuardResult } from "./types.js";

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
    timeoutSeconds: parseTimeoutSeconds(core.getInput("timeout-seconds")),
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findNearestPackageJson(startDirectory: string, workspaceRoot: string): Promise<string | null> {
  let current = startDirectory;
  const root = path.resolve(workspaceRoot);
  while (true) {
    const candidate = path.join(current, "package.json");
    if (await fileExists(candidate)) {
      return candidate;
    }
    if (current === root) {
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

async function warnIfDrizzleKitNotPinned(workingDirectory: string, workspaceRoot: string): Promise<void> {
  const packageJsonPath = await findNearestPackageJson(workingDirectory, workspaceRoot);
  if (!packageJsonPath) {
    core.debug("No package.json found to check drizzle-kit version.");
    return;
  }

  try {
    const raw = await readFile(packageJsonPath, "utf8");
    const data = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const version =
      data.dependencies?.["drizzle-kit"] ??
      data.devDependencies?.["drizzle-kit"] ??
      data.peerDependencies?.["drizzle-kit"];

    if (!version) {
      core.warning(
        `drizzle-kit is not declared in ${path.relative(
          workspaceRoot,
          packageJsonPath,
        )}. Add it to devDependencies to pin the version used by npx.`,
      );
      return;
    }

    core.debug(`drizzle-kit version resolved from package.json: ${version}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.warning(`Failed to read ${packageJsonPath} for drizzle-kit version: ${message}`);
  }
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

function shouldAttemptDynamicResolution(target: ConfigTarget, changedFiles: string[]): boolean {
  const scopePrefix = target.configDirectoryRelative
    ? `${target.configDirectoryRelative.toLowerCase()}/`
    : null;

  return changedFiles.some((file) => {
    const normalized = file.toLowerCase();
    const basename = path.posix.basename(normalized);

    if (scopePrefix && normalized.startsWith(scopePrefix)) {
      return true;
    }

    return (
      normalized.endsWith(".sql") ||
      normalized.includes("/drizzle/") ||
      normalized.includes("/migration") ||
      normalized.includes("/schema") ||
      normalized.includes("/db/") ||
      basename.startsWith("drizzle.config.") ||
      basename.includes("schema")
    );
  });
}

async function run(): Promise<void> {
  const inputs = resolveInputs();
  assertWorkingDirectory(inputs.workspaceRoot, inputs.workingDirectory);
  await warnIfDrizzleKitNotPinned(inputs.workingDirectory, inputs.workspaceRoot);
  core.debug(
    `Inputs: ${JSON.stringify(
      {
        workspaceRoot: inputs.workspaceRoot,
        workingDirectory: inputs.workingDirectory,
        configInput: inputs.configInput,
        failOn: inputs.failOn,
        commentMode: inputs.commentMode,
        timeoutSeconds: inputs.timeoutSeconds,
        hasGithubToken: Boolean(inputs.githubToken),
      },
      null,
      2,
    )}`,
  );

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
    core.debug(
      `[${target.configPathRelative}] schema patterns: ${target.schemaPatterns.join(", ") || "none"}`,
    );
  });
  core.endGroup();

  let changedFiles: string[] | null = null;
  if (hasPullRequestContext() && inputs.githubToken) {
    core.startGroup("Read pull request files");
    changedFiles = await getPullRequestChangedFiles(inputs.githubToken);
    core.info(`Loaded ${changedFiles?.length ?? 0} changed file(s) from the pull request.`);
    if (changedFiles && changedFiles.length > 0) {
      core.debug(`First changed files: ${changedFiles.slice(0, 10).join(", ")}`);
    }
    core.endGroup();
  } else if (hasPullRequestContext()) {
    core.warning("github-token was not provided, so drizzle-migration-guard will check every config.");
  }

  const results: GuardResult[] = [];

  for (const initialTarget of targets) {
    let target = initialTarget;
    let matchedFiles = changedFiles ? findMatchedFiles(target, changedFiles) : [];

    if (
      changedFiles !== null &&
      matchedFiles.length === 0 &&
      target.needsDynamicResolution &&
      shouldAttemptDynamicResolution(target, changedFiles)
    ) {
      target = await hydrateConfigTarget(target, inputs.workspaceRoot);
      matchedFiles = findMatchedFiles(target, changedFiles);
    }

    const shouldSkip = changedFiles !== null && matchedFiles.length === 0;

    if (shouldSkip) {
      core.debug(`Skipping ${target.configPathRelative} (no matching files in PR).`);
      results.push(buildSkippedResult(target, matchedFiles));
      continue;
    }

    core.startGroup(`Run drizzle-kit check for ${target.configPathRelative}`);
    const execution = await runDrizzleCheck(target, inputs.workingDirectory, {
      timeoutMs: inputs.timeoutSeconds * 1000,
    });
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
