import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

export interface CliResult {
  ok: boolean;
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  json?: unknown;
}

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 120_000;

export async function projectDirectory(value?: string): Promise<string> {
  const directory = resolve(value ?? process.cwd());
  const metadata = await stat(directory).catch(() => undefined);
  if (!metadata?.isDirectory()) {
    throw new Error(`Micro project directory does not exist: ${directory}`);
  }
  return directory;
}

export async function runMicro(
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<CliResult> {
  const executable = process.env.MICRO_CLI || "micro";
  const cwd = await projectDirectory(options.cwd);
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  return await new Promise<CliResult>((resolveResult, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let terminated = false;
    const timeout = setTimeout(() => {
      terminated = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    const append = (target: Buffer[], chunk: Buffer): void => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        terminated = true;
        child.kill("SIGTERM");
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => append(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => append(stderr, chunk));
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      const stdoutText = Buffer.concat(stdout).toString("utf8").trim();
      const stderrText = Buffer.concat(stderr).toString("utf8").trim();
      let json: unknown;
      if (stdoutText.startsWith("{") || stdoutText.startsWith("[")) {
        try {
          json = JSON.parse(stdoutText);
        } catch {
          json = undefined;
        }
      }
      const exitCode = code ?? (terminated ? 124 : 1);
      resolveResult({
        ok: exitCode === 0 && !terminated,
        command: ["micro", ...args],
        exitCode,
        stdout: stdoutText,
        stderr: terminated
          ? `${stderrText}${stderrText ? "\n" : ""}micro command exceeded its output or time limit`
          : stderrText,
        ...(json === undefined ? {} : { json }),
      });
    });
  });
}
