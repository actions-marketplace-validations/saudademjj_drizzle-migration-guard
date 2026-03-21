import * as core from "@actions/core";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import fg, { isDynamicPattern } from "fast-glob";
import jiti from "jiti";

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
    new RegExp(`\\b${propertyName}\\s*:\\s*(['"\`])([^\\n]*?)\\1`, "m"),
  );

  if (!match) {
    return null;
  }

  const [, quote, value] = match;
  if (quote === "`" && value.includes("${")) {
    return null;
  }

  return value;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function parseSchemaPatterns(source: string): string[] {
  const arrayMatch = source.match(/\bschema\s*:\s*\[([\s\S]*?)\]/m);
  if (arrayMatch) {
    return extractStringLiterals(arrayMatch[1]);
  }

  const single = parseSingleStringProperty(source, "schema");
  return single ? [single] : [];
}

function parseSchemaField(source: string): {
  hasField: boolean;
  isStatic: boolean;
  patterns: string[];
} {
  const arrayMatch = source.match(/\bschema\s*:\s*\[([\s\S]*?)\]/m);
  if (arrayMatch) {
    return {
      hasField: true,
      isStatic: true,
      patterns: extractStringLiterals(arrayMatch[1]),
    };
  }

  const single = parseSingleStringProperty(source, "schema");
  if (single !== null) {
    return {
      hasField: true,
      isStatic: true,
      patterns: [single],
    };
  }

  return {
    hasField: /\bschema\s*:/.test(source),
    isStatic: false,
    patterns: [],
  };
}

function normalizeSchemaValue(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function normalizeOutValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseOutField(source: string): {
  hasField: boolean;
  isStatic: boolean;
  value: string | null;
} {
  const value = parseSingleStringProperty(source, "out");
  if (value !== null) {
    return {
      hasField: true,
      isStatic: true,
      value,
    };
  }

  return {
    hasField: /\bout\s*:/.test(source),
    isStatic: false,
    value: null,
  };
}

async function loadConfigExport(configPath: string): Promise<unknown | null> {
  try {
    const loader = jiti(configPath, { interopDefault: true, esmResolve: true, cache: false });
    const loaded = loader(configPath);
    const resolved = loaded && typeof loaded === "object" && "default" in loaded ? loaded.default : loaded;
    if (resolved && typeof (resolved as Promise<unknown>)?.then === "function") {
      return await (resolved as Promise<unknown>);
    }
    return resolved ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.debug(`Failed to load drizzle config ${configPath} via jiti: ${message}`);
    return null;
  }
}

async function normalizeConfigExport(configExport: unknown): Promise<Record<string, unknown> | null> {
  if (!configExport) {
    return null;
  }

  if (typeof configExport === "function") {
    try {
      const result = configExport();
      const resolved =
        result && typeof (result as Promise<unknown>)?.then === "function"
          ? await (result as Promise<unknown>)
          : result;
      return resolved && typeof resolved === "object" ? (resolved as Record<string, unknown>) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.debug(`Failed to execute drizzle config export: ${message}`);
      return null;
    }
  }

  if (typeof (configExport as Promise<unknown>)?.then === "function") {
    try {
      const resolved = await (configExport as Promise<unknown>);
      return resolved && typeof resolved === "object" ? (resolved as Record<string, unknown>) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.debug(`Failed to await drizzle config export: ${message}`);
      return null;
    }
  }

  if (typeof configExport === "object") {
    return configExport as Record<string, unknown>;
  }

  return null;
}

function normalizePatternToWorkspace(
  rawPattern: string,
  configDirectory: string,
  workspaceRoot: string,
): string {
  const joined = path.resolve(configDirectory, rawPattern);
  return workspaceRelative(joined, workspaceRoot);
}

function buildConfigTarget(options: {
  configPath: string;
  configDirectory: string;
  workspaceRoot: string;
  migrationDirectoryRaw: string;
  schemaPatternsRaw: string[];
  needsDynamicResolution: boolean;
}): ConfigTarget {
  const configPathRelative = workspaceRelative(options.configPath, options.workspaceRoot);
  const configDirectoryRelative = workspaceRelative(options.configDirectory, options.workspaceRoot);
  const migrationDirectory = path.resolve(options.configDirectory, options.migrationDirectoryRaw);
  const migrationDirectoryRelative = workspaceRelative(migrationDirectory, options.workspaceRoot);
  const schemaPatterns = options.schemaPatternsRaw.map((pattern) =>
    normalizePatternToWorkspace(pattern, options.configDirectory, options.workspaceRoot),
  );
  const relevantPatterns = unique([
    configPathRelative,
    `${migrationDirectoryRelative}/**`,
    ...schemaPatterns,
    ...ALWAYS_RELEVANT_PATTERNS,
  ]);

  return {
    configPath: options.configPath,
    configPathRelative,
    configDirectory: options.configDirectory,
    configDirectoryRelative,
    migrationDirectory,
    migrationDirectoryRelative,
    schemaPatterns,
    relevantPatterns,
    needsDynamicResolution: options.needsDynamicResolution,
  };
}

async function buildStaticConfigTarget(configPath: string, workspaceRoot: string): Promise<ConfigTarget> {
  const source = await readFile(configPath, "utf8");
  const strippedSource = stripComments(source);
  const configDirectory = path.dirname(configPath);
  const parsedSchema = parseSchemaField(strippedSource);
  const parsedOut = parseOutField(strippedSource);

  return buildConfigTarget({
    configPath,
    configDirectory,
    workspaceRoot,
    migrationDirectoryRaw: parsedOut.value ?? "drizzle",
    schemaPatternsRaw: parsedSchema.patterns,
    needsDynamicResolution:
      (parsedSchema.hasField && !parsedSchema.isStatic) ||
      (parsedOut.hasField && !parsedOut.isStatic),
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export async function hydrateConfigTarget(
  target: ConfigTarget,
  workspaceRoot: string,
  options: { timeoutMs?: number } = {},
): Promise<ConfigTarget> {
  if (!target.needsDynamicResolution) {
    return target;
  }

  const timeoutMs = options.timeoutMs ?? 1500;

  try {
    const configObject = await withTimeout(
      loadConfigExport(target.configPath).then((configExport) => normalizeConfigExport(configExport)),
      timeoutMs,
      `Loading drizzle config ${target.configPathRelative}`,
    );

    if (!configObject) {
      return {
        ...target,
        needsDynamicResolution: false,
      };
    }

    const schemaFromConfig = normalizeSchemaValue(configObject.schema);
    const outFromConfig = normalizeOutValue(configObject.out);
    const migrationDirectory = outFromConfig
      ? path.resolve(target.configDirectory, outFromConfig)
      : target.migrationDirectory;
    const migrationDirectoryRelative = workspaceRelative(migrationDirectory, workspaceRoot);
    const schemaPatterns =
      schemaFromConfig.length > 0
        ? schemaFromConfig.map((pattern) =>
            normalizePatternToWorkspace(pattern, target.configDirectory, workspaceRoot),
          )
        : target.schemaPatterns;
    const relevantPatterns = unique([
      target.configPathRelative,
      `${migrationDirectoryRelative}/**`,
      ...schemaPatterns,
      ...ALWAYS_RELEVANT_PATTERNS,
    ]);

    return {
      ...target,
      migrationDirectory,
      migrationDirectoryRelative,
      schemaPatterns,
      relevantPatterns,
      needsDynamicResolution: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.debug(`Lazy config hydration skipped for ${target.configPathRelative}: ${message}`);
    return {
      ...target,
      needsDynamicResolution: false,
    };
  }
}

async function resolveExplicitConfigs(configInput: string[], workingDirectory: string): Promise<string[]> {
  const resolved: string[] = [];

  for (const entry of configInput) {
    if (isDynamicPattern(entry)) {
      const matches = await fg(entry, {
        cwd: workingDirectory,
        absolute: true,
        onlyFiles: true,
        dot: true,
      });
      if (matches.length === 0) {
        throw new Error(`Config glob did not match any files: ${entry}`);
      }
      resolved.push(...matches);
      continue;
    }

    resolved.push(path.isAbsolute(entry) ? entry : path.resolve(workingDirectory, entry));
  }

  return unique(resolved);
}

export async function discoverConfigTargets(options: {
  workspaceRoot: string;
  workingDirectory: string;
  configInput: string;
  resolveConfigExports?: boolean;
}): Promise<ConfigTarget[]> {
  const explicitConfigs = splitInputList(options.configInput);

  const configPaths =
    explicitConfigs.length > 0
      ? await resolveExplicitConfigs(explicitConfigs, options.workingDirectory)
      : await discoverDefaultConfig(options.workingDirectory);

  for (const configPath of configPaths) {
    if (!(await fileExists(configPath))) {
      throw new Error(`Could not find drizzle config at ${configPath}`);
    }
  }

  const targets = await Promise.all(
    unique(configPaths).map(async (configPath) => {
      const target = await buildStaticConfigTarget(configPath, options.workspaceRoot);
      if (options.resolveConfigExports) {
        return hydrateConfigTarget(target, options.workspaceRoot);
      }
      return target;
    }),
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
