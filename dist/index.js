"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var core2 = __toESM(require("@actions/core"));
var import_node_path5 = __toESM(require("path"));

// src/checker.ts
var exec = __toESM(require("@actions/exec"));
var import_node_path = __toESM(require("path"));
async function runDrizzleCheck(target, workingDirectory, options = {}) {
  let stdout = "";
  let stderr = "";
  const binary = options.toolingDirectory !== void 0 ? import_node_path.default.join(
    options.toolingDirectory,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit"
  ) : "npx";
  const args = options.toolingDirectory !== void 0 ? ["check", "--config", target.configPath] : ["--no-install", "drizzle-kit", "check", "--config", target.configPath];
  const command = `${binary} ${args.join(" ")}`;
  const exitCode = await exec.exec(binary, args, {
    cwd: workingDirectory,
    ignoreReturnCode: true,
    silent: true,
    env: {
      ...process.env,
      FORCE_COLOR: "0"
    },
    listeners: {
      stdout: (chunk) => {
        stdout += chunk.toString();
      },
      stderr: (chunk) => {
        stderr += chunk.toString();
      }
    }
  });
  return {
    target,
    exitCode,
    stdout,
    stderr,
    command
  };
}

// src/discovery.ts
var import_promises = require("fs/promises");
var import_node_path3 = __toESM(require("path"));

// src/utils.ts
var import_node_path2 = __toESM(require("path"));
var import_minimatch = require("minimatch");
function toPosixPath(value) {
  return value.split(import_node_path2.default.sep).join("/");
}
function workspaceRelative(absolutePath, workspaceRoot) {
  const relative = toPosixPath(import_node_path2.default.relative(workspaceRoot, absolutePath));
  return relative.replace(/^\.\//, "");
}
function splitInputList(raw) {
  return raw.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}
function unique(values) {
  return [...new Set(values)];
}
function stripAnsi(value) {
  return value.replace(
    // eslint-disable-next-line no-control-regex
    /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    ""
  );
}
function extractStringLiterals(value) {
  const matches = value.matchAll(/["'`]([^"'`]+)["'`]/g);
  return [...matches].map((match) => match[1]);
}
function normalizeFileList(files) {
  return unique(
    files.map((file) => file.trim()).filter(Boolean).map((file) => file.replace(/^\/+/, "")).map((file) => file.replace(/\\/g, "/"))
  );
}
function matchesRelevantPattern(file, pattern) {
  if (!pattern) {
    return false;
  }
  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3);
    return file === base || file.startsWith(`${base}/`) || (0, import_minimatch.minimatch)(file, pattern, { dot: true });
  }
  return file === pattern || (0, import_minimatch.minimatch)(file, pattern, { dot: true });
}
function shorten(value, maxLength = 240) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}...`;
}
function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

// src/discovery.ts
var DEFAULT_CONFIG_NAMES = [
  "drizzle.config.ts",
  "drizzle.config.mts",
  "drizzle.config.cts",
  "drizzle.config.js",
  "drizzle.config.mjs",
  "drizzle.config.cjs"
];
var ALWAYS_RELEVANT_PATTERNS = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "bun.lock"
];
async function fileExists(filePath) {
  try {
    await (0, import_promises.access)(filePath);
    return true;
  } catch {
    return false;
  }
}
function parseSingleStringProperty(source, propertyName) {
  const match = source.match(
    new RegExp(`\\b${propertyName}\\s*:\\s*["'\`]([^"'\\\`]+)["'\`]`, "m")
  );
  return match?.[1] ?? null;
}
function parseSchemaPatterns(source) {
  const arrayMatch = source.match(/\bschema\s*:\s*\[([\s\S]*?)\]/m);
  if (arrayMatch) {
    return extractStringLiterals(arrayMatch[1]);
  }
  const single = parseSingleStringProperty(source, "schema");
  return single ? [single] : [];
}
function normalizePatternToWorkspace(rawPattern, configDirectory, workspaceRoot) {
  const joined = import_node_path3.default.resolve(configDirectory, rawPattern);
  return workspaceRelative(joined, workspaceRoot);
}
async function buildConfigTarget(configPath, workspaceRoot) {
  const source = await (0, import_promises.readFile)(configPath, "utf8");
  const configDirectory = import_node_path3.default.dirname(configPath);
  const migrationDirectoryRaw = parseSingleStringProperty(source, "out") ?? "drizzle";
  const migrationDirectory = import_node_path3.default.resolve(configDirectory, migrationDirectoryRaw);
  const schemaPatterns = parseSchemaPatterns(source).map(
    (pattern) => normalizePatternToWorkspace(pattern, configDirectory, workspaceRoot)
  );
  const configPathRelative = workspaceRelative(configPath, workspaceRoot);
  const migrationDirectoryRelative = workspaceRelative(migrationDirectory, workspaceRoot);
  const relevantPatterns = unique([
    configPathRelative,
    `${migrationDirectoryRelative}/**`,
    ...schemaPatterns,
    ...ALWAYS_RELEVANT_PATTERNS
  ]);
  return {
    configPath,
    configPathRelative,
    configDirectory,
    migrationDirectory,
    migrationDirectoryRelative,
    schemaPatterns,
    relevantPatterns
  };
}
async function discoverConfigTargets(options) {
  const explicitConfigs = splitInputList(options.configInput);
  const configPaths = explicitConfigs.length > 0 ? explicitConfigs.map(
    (config) => import_node_path3.default.isAbsolute(config) ? config : import_node_path3.default.resolve(options.workingDirectory, config)
  ) : await discoverDefaultConfig(options.workingDirectory);
  for (const configPath of configPaths) {
    if (!await fileExists(configPath)) {
      throw new Error(`Could not find drizzle config at ${configPath}`);
    }
  }
  const targets = await Promise.all(
    unique(configPaths).map((configPath) => buildConfigTarget(configPath, options.workspaceRoot))
  );
  return targets;
}
async function discoverDefaultConfig(workingDirectory) {
  for (const candidate of DEFAULT_CONFIG_NAMES) {
    const candidatePath = import_node_path3.default.resolve(workingDirectory, candidate);
    if (await fileExists(candidatePath)) {
      return [candidatePath];
    }
  }
  throw new Error(
    `No drizzle config found in ${workingDirectory}. Set the config input to a drizzle.config.* file.`
  );
}
function findMatchedFiles(target, changedFiles) {
  return changedFiles.filter(
    (file) => target.relevantPatterns.some((pattern) => matchesRelevantPattern(file, pattern))
  );
}

// src/github.ts
var core = __toESM(require("@actions/core"));
var github = __toESM(require("@actions/github"));
function getPullRequestNumber() {
  const pullRequest = github.context.payload.pull_request;
  return pullRequest?.number ?? null;
}
function hasPullRequestContext() {
  return getPullRequestNumber() !== null;
}
async function getPullRequestChangedFiles(githubToken) {
  const pullRequestNumber = getPullRequestNumber();
  if (!pullRequestNumber || !githubToken) {
    return null;
  }
  const { owner, repo } = github.context.repo;
  const octokit = github.getOctokit(githubToken);
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullRequestNumber,
    per_page: 100
  });
  return normalizeFileList(files.map((file) => file.filename));
}
async function syncStickyComment(options) {
  const pullRequestNumber = getPullRequestNumber();
  if (!pullRequestNumber) {
    return;
  }
  const { owner, repo } = github.context.repo;
  const octokit = github.getOctokit(options.githubToken);
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pullRequestNumber,
    per_page: 100
  });
  const existing = comments.find((comment) => comment.body?.includes(options.marker));
  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: options.body
    });
    core.info(`Updated sticky PR comment ${existing.id}.`);
    return;
  }
  if (!options.allowCreate) {
    return;
  }
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullRequestNumber,
    body: options.body
  });
  core.info("Created sticky PR comment.");
}

// src/parser.ts
var NOISE_PATTERNS = [/^No config path provided/i, /^Reading config file /i];
function extractInterestingLines(output) {
  const clean = stripAnsi(output).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !NOISE_PATTERNS.some((pattern) => pattern.test(line)));
  return unique(clean);
}
function classifyFailure(output) {
  if (/(which is a collision|data is malformed|snapshot is of unsupported version|is not of the latest version|drizzle\/meta\/.+snapshot\.json)/i.test(
    output
  )) {
    return "collision/history";
  }
  if (/(expected property name or '\}' in json|unexpected token.+json|json at position)/i.test(output)) {
    return "collision/history";
  }
  if (/(cannot find module|err_module_not_found|unknown file extension|eacces|permission denied|npx canceled due to missing packages|command not found|enoent|failed to load|config)/i.test(
    output
  )) {
    return "config/dependency";
  }
  return "unknown";
}
function buildHeadline(category) {
  switch (category) {
    case "collision/history":
      return "Drizzle reported a migration history collision";
    case "config/dependency":
      return "drizzle-kit could not run cleanly";
    case "unknown":
      return "drizzle-kit check failed with an unclassified error";
  }
}
function parseCheckExecution(execution) {
  const combinedOutput = stripAnsi([execution.stdout, execution.stderr].filter(Boolean).join("\n")).trim();
  if (execution.exitCode === 0) {
    return {
      passed: true,
      category: null,
      headline: "Migration history is consistent",
      details: ["drizzle-kit check completed without collisions."]
    };
  }
  const details = extractInterestingLines(combinedOutput);
  const category = classifyFailure(combinedOutput);
  return {
    passed: false,
    category,
    headline: buildHeadline(category),
    details: details.length > 0 ? details.map((line) => shorten(line, 280)).slice(0, 8) : [`drizzle-kit exited with code ${execution.exitCode}.`]
  };
}

// src/reporters.ts
var import_promises2 = require("fs/promises");
var import_node_os = __toESM(require("os"));
var import_node_path4 = __toESM(require("path"));
var COMMENT_MARKER = "<!-- drizzle-migration-guard -->";
function isBlockingFailure(category, failOn) {
  if (category === null || failOn === "none") {
    return false;
  }
  if (failOn === "all") {
    return true;
  }
  return category === "collision/history";
}
function renderStatusBadge(result) {
  if (result.status === "success") {
    return "PASS";
  }
  if (result.status === "skipped") {
    return "SKIP";
  }
  return result.blocking ? "FAIL" : "WARN";
}
function renderCategoryLabel(category) {
  return category ?? "-";
}
function buildFixRecipe(category, configPath) {
  switch (category) {
    case "collision/history":
      return [
        "Pull the latest default branch and rebase or merge it into your PR branch.",
        `Re-run \`npx drizzle-kit generate --config ${configPath}\` so Drizzle rebuilds the migration chain on top of the latest snapshots.`,
        "Push the regenerated migration and let the action re-check the branch."
      ];
    case "config/dependency":
      return [
        "Make sure project dependencies are installed before this action runs.",
        `Run \`npx drizzle-kit check --config ${configPath}\` locally to confirm the config file resolves cleanly.`,
        "If the config imports TypeScript helpers, verify the files exist in CI and the working-directory input points at the right package."
      ];
    case "unknown":
      return [
        `Run \`npx drizzle-kit check --config ${configPath}\` locally and compare the raw output with the CI log.`,
        "If this is a repeatable drizzle-kit edge case, keep the raw output in the PR and tighten the parser in a follow-up release."
      ];
    default:
      return ["No action needed."];
  }
}
function deriveOverallStatus(results) {
  if (results.some((result) => result.status === "failed" && result.blocking)) {
    return "failure";
  }
  if (results.every((result) => result.status === "skipped")) {
    return "skipped";
  }
  return "success";
}
function buildOverallSummary(results, overallStatus) {
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
    `${skipped} ${pluralize(skipped, "check")} skipped`
  ];
  return `drizzle-migration-guard finished with ${parts.join(", ")}.`;
}
function renderTable(results) {
  const rows = results.map((result) => {
    return `| ${renderStatusBadge(result)} | \`${result.target.configPathRelative}\` | \`${renderCategoryLabel(
      result.category
    )}\` | ${shorten(result.summary, 80)} |`;
  });
  return [
    "| Status | Config | Category | Summary |",
    "| --- | --- | --- | --- |",
    ...rows
  ].join("\n");
}
function renderResultSection(result) {
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
    const outputBlock = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
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
function renderReportMarkdown(summary2, results, overallStatus) {
  const lines = ["# drizzle-migration-guard", "", summary2, ""];
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
function renderCommentMarkdown(report) {
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
async function writeMarkdownReport(markdown) {
  const baseDirectory = process.env.RUNNER_TEMP ?? import_node_os.default.tmpdir();
  const reportDirectory = await (0, import_promises2.mkdtemp)(import_node_path4.default.join(baseDirectory, "drizzle-migration-guard-"));
  const reportPath = import_node_path4.default.join(reportDirectory, "report.md");
  await (0, import_promises2.writeFile)(reportPath, markdown, "utf8");
  return reportPath;
}

// src/index.ts
function parseFailOnMode(raw) {
  if (raw === "all" || raw === "none") {
    return raw;
  }
  return "collision";
}
function parseCommentMode(raw) {
  return raw === "off" ? "off" : "sticky";
}
function resolveInputs() {
  const workspaceRoot = import_node_path5.default.resolve(process.env.GITHUB_WORKSPACE ?? process.cwd());
  const workingDirectoryInput = core2.getInput("working-directory") || ".";
  const workingDirectory = import_node_path5.default.resolve(workspaceRoot, workingDirectoryInput);
  return {
    workspaceRoot,
    workingDirectory,
    configInput: core2.getInput("config"),
    failOn: parseFailOnMode(core2.getInput("fail-on")),
    commentMode: parseCommentMode(core2.getInput("comment-mode")),
    githubToken: core2.getInput("github-token")
  };
}
function buildSkippedResult(target, matchedFiles) {
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
    matchedFiles
  };
}
function publishAnnotations(results) {
  for (const result of results) {
    if (result.status === "success") {
      core2.info(`[${result.target.configPathRelative}] ${result.summary}`);
      continue;
    }
    if (result.status === "skipped") {
      core2.info(`[${result.target.configPathRelative}] ${result.summary}`);
      continue;
    }
    const message = [
      result.summary,
      ...result.details.slice(0, 3),
      `Command: ${result.command ?? "n/a"}`
    ].join("\n");
    if (result.blocking) {
      core2.error(message);
    } else {
      core2.warning(message);
    }
  }
}
async function run() {
  const inputs = resolveInputs();
  core2.startGroup("Discover Drizzle configs");
  const targets = await discoverConfigTargets({
    workspaceRoot: inputs.workspaceRoot,
    workingDirectory: inputs.workingDirectory,
    configInput: inputs.configInput
  });
  targets.forEach((target) => {
    core2.info(
      `Found ${target.configPathRelative} with migration directory ${target.migrationDirectoryRelative}`
    );
  });
  core2.endGroup();
  let changedFiles = null;
  if (hasPullRequestContext() && inputs.githubToken) {
    core2.startGroup("Read pull request files");
    changedFiles = await getPullRequestChangedFiles(inputs.githubToken);
    core2.info(`Loaded ${changedFiles?.length ?? 0} changed file(s) from the pull request.`);
    core2.endGroup();
  } else if (hasPullRequestContext()) {
    core2.warning("github-token was not provided, so drizzle-migration-guard will check every config.");
  }
  const results = [];
  for (const target of targets) {
    const matchedFiles = changedFiles ? findMatchedFiles(target, changedFiles) : [];
    const shouldSkip = changedFiles !== null && matchedFiles.length === 0;
    if (shouldSkip) {
      results.push(buildSkippedResult(target, matchedFiles));
      continue;
    }
    core2.startGroup(`Run drizzle-kit check for ${target.configPathRelative}`);
    const execution = await runDrizzleCheck(target, inputs.workingDirectory);
    const parsed = parseCheckExecution(execution);
    core2.info(parsed.headline);
    core2.endGroup();
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
      matchedFiles
    });
  }
  publishAnnotations(results);
  const overallStatus = deriveOverallStatus(results);
  const summary2 = buildOverallSummary(results, overallStatus);
  const markdown = renderReportMarkdown(summary2, results, overallStatus);
  const reportPath = await writeMarkdownReport(markdown);
  await core2.summary.addRaw(markdown).write();
  core2.setOutput("status", overallStatus);
  core2.setOutput("summary", summary2);
  core2.setOutput("report-path", reportPath);
  const hasFailures = results.some((result) => result.status === "failed");
  if (inputs.commentMode === "sticky" && inputs.githubToken && hasPullRequestContext()) {
    const commentBody = renderCommentMarkdown({
      status: overallStatus,
      summary: summary2,
      results,
      markdown,
      reportPath
    });
    await syncStickyComment({
      githubToken: inputs.githubToken,
      body: commentBody,
      marker: COMMENT_MARKER,
      allowCreate: hasFailures
    });
  }
  if (overallStatus === "failure") {
    core2.setFailed(summary2);
  }
}
run().catch((error2) => {
  const message = error2 instanceof Error ? error2.message : String(error2);
  core2.setFailed(message);
});
//# sourceMappingURL=index.js.map