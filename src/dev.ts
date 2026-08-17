import { type ChildProcessByStdio, spawn } from "node:child_process";
import type { Readable } from "node:stream";

import { projectDirectory } from "./cli.js";

const MAX_LOG_BYTES = 1024 * 1024;
const START_TIMEOUT_MS = 10_000;

interface DevelopmentProcess {
  child: ChildProcessByStdio<null, Readable, Readable>;
  directory: string;
  port: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  exitCode?: number;
}

export interface DevelopmentStatus {
  ok: boolean;
  running: boolean;
  directory: string;
  url?: string;
  pid?: number;
  startedAt?: string;
  exitCode?: number;
  stdout: string;
  stderr: string;
}

const processes = new Map<string, DevelopmentProcess>();

function terminate(development: DevelopmentProcess): void {
  const pid = development.child.pid;
  if (pid !== undefined && process.platform !== "win32") {
    try {
      process.kill(-pid, "SIGTERM");
      return;
    } catch {
      // The process group may already be gone; fall through to the child.
    }
  }
  development.child.kill("SIGTERM");
}

function terminateAll(): void {
  for (const development of processes.values()) {
    if (development.exitCode === undefined && development.child.exitCode === null) terminate(development);
  }
}

process.once("exit", terminateAll);
process.once("SIGINT", () => {
  terminateAll();
  process.exit(130);
});
process.once("SIGTERM", () => {
  terminateAll();
  process.exit(143);
});

function appendBounded(current: string, chunk: Buffer): string {
  const next = current + chunk.toString("utf8");
  return next.length <= MAX_LOG_BYTES ? next : next.slice(next.length - MAX_LOG_BYTES);
}

function snapshot(process: DevelopmentProcess): DevelopmentStatus {
  const running = process.exitCode === undefined && process.child.exitCode === null;
  return {
    ok: running,
    running,
    directory: process.directory,
    ...(running ? { url: `http://127.0.0.1:${process.port}` } : {}),
    ...(process.child.pid === undefined ? {} : { pid: process.child.pid }),
    startedAt: process.startedAt,
    ...(process.exitCode === undefined ? {} : { exitCode: process.exitCode }),
    stdout: process.stdout.trim(),
    stderr: process.stderr.trim(),
  };
}

export async function startDevelopment(path: string | undefined, port: number): Promise<DevelopmentStatus> {
  const directory = await projectDirectory(path);
  const existing = processes.get(directory);
  if (existing && existing.exitCode === undefined && existing.child.exitCode === null) {
    return snapshot(existing);
  }
  const executable = process.env.MICRO_CLI || "micro";
  const child = spawn(executable, ["dev", "--port", String(port)], {
    cwd: directory,
    env: process.env,
    detached: process.platform !== "win32",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const development: DevelopmentProcess = {
    child,
    directory,
    port,
    stdout: "",
    stderr: "",
    startedAt: new Date().toISOString(),
  };
  processes.set(directory, development);
  child.stdout.on("data", (chunk: Buffer) => {
    development.stdout = appendBounded(development.stdout, chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    development.stderr = appendBounded(development.stderr, chunk);
  });
  child.once("error", (error) => {
    development.stderr = appendBounded(development.stderr, Buffer.from(error.message));
    development.exitCode = 1;
  });
  child.once("close", (code) => {
    development.exitCode = code ?? 1;
  });

  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (development.exitCode !== undefined || child.exitCode !== null) return snapshot(development);
    if (development.stdout.includes(`http://127.0.0.1:${port}`)) return snapshot(development);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  terminate(development);
  development.stderr = appendBounded(
    development.stderr,
    Buffer.from("micro dev did not report readiness within 10 seconds"),
  );
  development.exitCode = 124;
  return snapshot(development);
}

export async function developmentStatus(path?: string): Promise<DevelopmentStatus> {
  const directory = await projectDirectory(path);
  const development = processes.get(directory);
  if (!development) {
    return { ok: true, running: false, directory, stdout: "", stderr: "" };
  }
  return snapshot(development);
}

export async function stopDevelopment(path?: string): Promise<DevelopmentStatus> {
  const directory = await projectDirectory(path);
  const development = processes.get(directory);
  if (!development) {
    return { ok: true, running: false, directory, stdout: "", stderr: "" };
  }
  if (development.exitCode === undefined && development.child.exitCode === null) {
    terminate(development);
    await Promise.race([
      new Promise<void>((resolve) => development.child.once("close", () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
    ]);
  }
  if (development.exitCode === undefined) development.exitCode = development.child.exitCode ?? 0;
  const status = snapshot(development);
  processes.delete(directory);
  return { ...status, ok: true, running: false };
}
