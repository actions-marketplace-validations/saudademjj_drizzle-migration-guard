import * as exec from "@actions/exec";
import path from "node:path";

import type { CheckExecution, ConfigTarget } from "./types.js";

export async function runDrizzleCheck(
  target: ConfigTarget,
  workingDirectory: string,
  options: { toolingDirectory?: string } = {},
): Promise<CheckExecution> {
  let stdout = "";
  let stderr = "";
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

  const exitCode = await exec.exec(binary, args, {
    cwd: workingDirectory,
    ignoreReturnCode: true,
    silent: true,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
    },
    listeners: {
      stdout: (chunk) => {
        stdout += chunk.toString();
      },
      stderr: (chunk) => {
        stderr += chunk.toString();
      },
    },
  });

  return {
    target,
    exitCode,
    stdout,
    stderr,
    command,
  };
}
