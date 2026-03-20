export type FailureCategory = "collision/history" | "config/dependency" | "unknown";
export type ResultStatus = "success" | "failed" | "skipped";
export type OverallStatus = "success" | "failure" | "skipped";
export type FailOnMode = "collision" | "all" | "none";
export type CommentMode = "sticky" | "off";

export interface GuardInputs {
  workspaceRoot: string;
  workingDirectory: string;
  configInput: string;
  failOn: FailOnMode;
  commentMode: CommentMode;
  githubToken: string;
}

export interface ConfigTarget {
  configPath: string;
  configPathRelative: string;
  configDirectory: string;
  migrationDirectory: string;
  migrationDirectoryRelative: string;
  schemaPatterns: string[];
  relevantPatterns: string[];
}

export interface CheckExecution {
  target: ConfigTarget;
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
}

export interface ParsedCheck {
  passed: boolean;
  category: FailureCategory | null;
  headline: string;
  details: string[];
}

export interface GuardResult {
  target: ConfigTarget;
  status: ResultStatus;
  category: FailureCategory | null;
  blocking: boolean;
  summary: string;
  details: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  command: string | null;
  matchedFiles: string[];
}

export interface ActionReport {
  status: OverallStatus;
  summary: string;
  results: GuardResult[];
  markdown: string;
  reportPath: string;
}

