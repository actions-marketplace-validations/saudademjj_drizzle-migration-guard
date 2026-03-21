import * as exec from "@actions/exec";
import path from "node:path";

import type { CheckExecution, ConfigTarget } from "./types.js";

export async function runDrizzleCheck(
  target: ConfigTarget,
  workingDirectory: string,
  options: { toolingDirectory?: string; timeoutMs?: number } = {},
): Promise<CheckExecution> {
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const binary =
    options.toolingDirectory !== undefined
      ? path.join(
          options.toolingDirectory,
          "node_modules",
          ".bin",
          process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit",
        )
      : "npx";
  const args =
    options.toolingDirectory !== undefined
      ? ["check", "--config", target.configPath]
      : ["--no-install", "drizzle-kit", "check", "--config", target.configPath];
  const command = `${binary} ${args.join(" ")}`;
  const timeoutMs = options.timeoutMs ?? 60_000;

  let exitCode = -1;
  try {
    const execOptions: Parameters<typeof exec.exec>[2] & { timeout?: number } = {
      cwd: workingDirectory,
      ignoreReturnCode: true,
      silent: true,
      timeout: timeoutMs > 0 ? timeoutMs : undefined,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
      },
      listeners: {
        stdout: (chunk) => {
          stdout += chunk.toString();
        },
        stderr: (chunk) => {
          stderr += chunk.toString();
        },
      },
    };
    exitCode = await exec.exec(binary, args, execOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    timedOut =
      timeoutMs > 0 &&
      /timed out|timeout|operation was canceled|canceled/i.test(message);
    stderr += stderr ? `\n${message}` : message;
    if (timedOut) {
      const timeoutSeconds = Math.ceil(timeoutMs / 1000);
      const timeoutNotice = `drizzle-kit check timed out after ${timeoutSeconds}s.`;
      stderr += `\n${timeoutNotice}`;
    }
  }

  return {
    target,
    exitCode,
    stdout,
    stderr,
    command,
    timedOut,
    timeoutMs,
  };
}
