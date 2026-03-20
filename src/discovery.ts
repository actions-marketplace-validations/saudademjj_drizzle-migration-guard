import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { ConfigTarget } from "./types.js";
import {
  extractStringLiterals,
  matchesRelevantPattern,
  splitInputList,
  unique,
  workspaceRelative,
} from "./utils.js";

const DEFAULT_CONFIG_NAMES = [
  "drizzle.config.ts",
  "drizzle.config.mts",
  "drizzle.config.cts",
  "drizzle.config.js",
  "drizzle.config.mjs",
  "drizzle.config.cjs",
];

const ALWAYS_RELEVANT_PATTERNS = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseSingleStringProperty(source: string, propertyName: string): string | null {
  const match = source.match(
    new RegExp(`\\b${propertyName}\\s*:\\s*["'\`]([^"'\\\`]+)["'\`]`, "m"),
  );

  return match?.[1] ?? null;
}

function parseSchemaPatterns(source: string): string[] {
  const arrayMatch = source.match(/\bschema\s*:\s*\[([\s\S]*?)\]/m);
  if (arrayMatch) {
    return extractStringLiterals(arrayMatch[1]);
  }

  const single = parseSingleStringProperty(source, "schema");
  return single ? [single] : [];
}

function normalizePatternToWorkspace(
  rawPattern: string,
  configDirectory: string,
  workspaceRoot: string,
): string {
  const joined = path.resolve(configDirectory, rawPattern);
  return workspaceRelative(joined, workspaceRoot);
}

async function buildConfigTarget(configPath: string, workspaceRoot: string): Promise<ConfigTarget> {
  const source = await readFile(configPath, "utf8");
  const configDirectory = path.dirname(configPath);
  const migrationDirectoryRaw = parseSingleStringProperty(source, "out") ?? "drizzle";
  const migrationDirectory = path.resolve(configDirectory, migrationDirectoryRaw);
  const schemaPatterns = parseSchemaPatterns(source).map((pattern) =>
    normalizePatternToWorkspace(pattern, configDirectory, workspaceRoot),
  );

  const configPathRelative = workspaceRelative(configPath, workspaceRoot);
  const migrationDirectoryRelative = workspaceRelative(migrationDirectory, workspaceRoot);

  const relevantPatterns = unique([
    configPathRelative,
    `${migrationDirectoryRelative}/**`,
    ...schemaPatterns,
    ...ALWAYS_RELEVANT_PATTERNS,
  ]);

  return {
    configPath,
    configPathRelative,
    configDirectory,
    migrationDirectory,
    migrationDirectoryRelative,
    schemaPatterns,
    relevantPatterns,
  };
}

export async function discoverConfigTargets(options: {
  workspaceRoot: string;
  workingDirectory: string;
  configInput: string;
}): Promise<ConfigTarget[]> {
  const explicitConfigs = splitInputList(options.configInput);

  const configPaths =
    explicitConfigs.length > 0
      ? explicitConfigs.map((config) =>
          path.isAbsolute(config)
            ? config
            : path.resolve(options.workingDirectory, config),
        )
      : await discoverDefaultConfig(options.workingDirectory);

  for (const configPath of configPaths) {
    if (!(await fileExists(configPath))) {
      throw new Error(`Could not find drizzle config at ${configPath}`);
    }
  }

  const targets = await Promise.all(
    unique(configPaths).map((configPath) => buildConfigTarget(configPath, options.workspaceRoot)),
  );

  return targets;
}

async function discoverDefaultConfig(workingDirectory: string): Promise<string[]> {
  for (const candidate of DEFAULT_CONFIG_NAMES) {
    const candidatePath = path.resolve(workingDirectory, candidate);
    if (await fileExists(candidatePath)) {
      return [candidatePath];
    }
  }

  throw new Error(
    `No drizzle config found in ${workingDirectory}. Set the config input to a drizzle.config.* file.`,
  );
}

export function findMatchedFiles(target: ConfigTarget, changedFiles: string[]): string[] {
  return changedFiles.filter((file) =>
    target.relevantPatterns.some((pattern) => matchesRelevantPattern(file, pattern)),
  );
}

