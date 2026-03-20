import type { CheckExecution, FailureCategory, ParsedCheck } from "./types.js";
import { shorten, stripAnsi, unique } from "./utils.js";

const NOISE_PATTERNS = [/^No config path provided/i, /^Reading config file /i];

function extractInterestingLines(output: string): string[] {
  const clean = stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !NOISE_PATTERNS.some((pattern) => pattern.test(line)));

  return unique(clean);
}

function classifyFailure(output: string): FailureCategory {
  if (
    /(which is a collision|data is malformed|snapshot is of unsupported version|is not of the latest version|drizzle\/meta\/.+snapshot\.json)/i.test(
      output,
    )
  ) {
    return "collision/history";
  }

  if (/(expected property name or '\}' in json|unexpected token.+json|json at position)/i.test(output)) {
    return "collision/history";
  }

  if (
    /(cannot find module|err_module_not_found|unknown file extension|eacces|permission denied|npx canceled due to missing packages|command not found|enoent|failed to load|config)/i.test(
      output,
    )
  ) {
    return "config/dependency";
  }

  return "unknown";
}

function buildHeadline(category: FailureCategory): string {
  switch (category) {
    case "collision/history":
      return "Drizzle reported a migration history collision";
    case "config/dependency":
      return "drizzle-kit could not run cleanly";
    case "unknown":
      return "drizzle-kit check failed with an unclassified error";
  }
}

export function parseCheckExecution(execution: CheckExecution): ParsedCheck {
  const combinedOutput = stripAnsi([execution.stdout, execution.stderr].filter(Boolean).join("\n")).trim();

  if (execution.exitCode === 0) {
    return {
      passed: true,
      category: null,
      headline: "Migration history is consistent",
      details: ["drizzle-kit check completed without collisions."],
    };
  }

  const details = extractInterestingLines(combinedOutput);
  const category = classifyFailure(combinedOutput);

  return {
    passed: false,
    category,
    headline: buildHeadline(category),
    details:
      details.length > 0
        ? details.map((line) => shorten(line, 280)).slice(0, 8)
        : [`drizzle-kit exited with code ${execution.exitCode}.`],
  };
}

