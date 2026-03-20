import path from "node:path";

import { minimatch } from "minimatch";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function workspaceRelative(absolutePath: string, workspaceRoot: string): string {
  const relative = toPosixPath(path.relative(workspaceRoot, absolutePath));
  return relative.replace(/^\.\//, "");
}

export function splitInputList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function stripAnsi(value: string): string {
  return value.replace(
    // eslint-disable-next-line no-control-regex
    /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    "",
  );
}

export function extractStringLiterals(value: string): string[] {
  const matches = value.matchAll(/["'`]([^"'`]+)["'`]/g);
  return [...matches].map((match) => match[1]);
}

export function normalizeFileList(files: string[]): string[] {
  return unique(
    files
      .map((file) => file.trim())
      .filter(Boolean)
      .map((file) => file.replace(/^\/+/, ""))
      .map((file) => file.replace(/\\/g, "/")),
  );
}

export function matchesRelevantPattern(file: string, pattern: string): boolean {
  if (!pattern) {
    return false;
  }

  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3);
    return file === base || file.startsWith(`${base}/`) || minimatch(file, pattern, { dot: true });
  }

  return file === pattern || minimatch(file, pattern, { dot: true });
}

export function shorten(value: string, maxLength = 240): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

