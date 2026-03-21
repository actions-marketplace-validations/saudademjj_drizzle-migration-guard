import path from "node:path";

import type { CommentMode, FailOnMode } from "./types.js";

export function parseFailOnMode(raw: string): FailOnMode {
  const value = raw.trim();
  if (!value) {
    return "collision";
  }
  if (value === "collision" || value === "all" || value === "none") {
    return value;
  }
  throw new Error(`Invalid input "fail-on": ${raw}. Use collision, all, or none.`);
}

export function parseCommentMode(raw: string): CommentMode {
  const value = raw.trim();
  if (!value) {
    return "sticky";
  }
  if (value === "sticky" || value === "off") {
    return value;
  }
  throw new Error(`Invalid input "comment-mode": ${raw}. Use sticky or off.`);
}

export function parseTimeoutSeconds(raw: string): number {
  const value = raw.trim();
  if (!value) {
    return 60;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid input "timeout-seconds": ${raw}. Use a positive number.`);
  }
  return Math.floor(parsed);
}

export function assertWorkingDirectory(workspaceRoot: string, workingDirectory: string): void {
  const relative = path.relative(workspaceRoot, workingDirectory);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `working-directory must resolve within the workspace (${workspaceRoot}). Got ${workingDirectory}.`,
    );
  }
}
