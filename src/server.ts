import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { type CliResult, runMicro } from "./cli.js";
import { developmentStatus, startDevelopment, stopDevelopment } from "./dev.js";

const directoryInput = z.object({
  path: z.string().optional().describe("Micro project directory; defaults to the server working directory"),
});

const cliOutput = z.object({
  ok: z.boolean(),
  command: z.array(z.string()),
  exitCode: z.number(),
  stdout: z.string(),
  stderr: z.string(),
  json: z.unknown().optional(),
});

const developmentOutput = z.object({
  ok: z.boolean(),
  running: z.boolean(),
  directory: z.string(),
  url: z.string().optional(),
  pid: z.number().optional(),
  startedAt: z.string().optional(),
  exitCode: z.number().optional(),
  stdout: z.string(),
  stderr: z.string(),
});

function developmentResult(value: Awaited<ReturnType<typeof developmentStatus>>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
    isError: !value.ok,
  };
}

function result(value: CliResult) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
    isError: !value.ok,
  };
}

async function invoke(args: string[], path?: string) {
  try {
    return result(await runMicro(args, { cwd: path }));
  } catch (error) {
    return result({
      ok: false,
      command: ["micro", ...args],
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    });
  }
}

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: "micro-mcp", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Use the Micro skill before mutating a site. Never pass passwords, provider keys, owner sessions, or deployment tokens through these tools.",
    },
  );

  server.registerTool(
    "micro_doctor",
    {
      title: "Check Micro CLI compatibility",
      description: "Check the installed Micro CLI version and authenticated owner status.",
      inputSchema: z.object({}),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => {
      const version = await runMicro(["--version"]);
      if (!version.ok) return result(version);
      const account = await runMicro(["account", "status", "--json"]);
      return result({
        ...account,
        stdout: JSON.stringify({ version: version.stdout, account: account.json ?? account.stdout }),
        json: { version: version.stdout, account: account.json ?? account.stdout },
      });
    },
  );

  server.registerTool(
    "micro_build",
    {
      title: "Build a Micro",
      description: "Compile and validate the conventional Micro project without deploying it.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ path }) => await invoke(["build", "--json"], path),
  );

  server.registerTool(
    "micro_dev_start",
    {
      title: "Start local Micro development",
      description: "Build and start the official loopback-only disposable Micro runner for this project.",
      inputSchema: directoryInput.extend({ port: z.number().int().min(1024).max(65535).default(8787) }),
      outputSchema: developmentOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ path, port }) => developmentResult(await startDevelopment(path, port)),
  );

  server.registerTool(
    "micro_dev_status",
    {
      title: "Inspect local Micro development",
      description: "Read bounded process status and logs for the managed local Micro runner.",
      inputSchema: directoryInput,
      outputSchema: developmentOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ path }) => developmentResult(await developmentStatus(path)),
  );

  server.registerTool(
    "micro_dev_stop",
    {
      title: "Stop local Micro development",
      description: "Gracefully stop the managed local Micro runner for this project.",
      inputSchema: directoryInput,
      outputSchema: developmentOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ path }) => developmentResult(await stopDevelopment(path)),
  );

  server.registerTool(
    "micro_preview",
    {
      title: "Create a Micro preview",
      description: "Build and upload an opaque preview without creating a project or claiming a slug.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ path }) => await invoke(["deploy", "--preview", "--json"], path),
  );

  server.registerTool(
    "micro_deploy",
    {
      title: "Deploy a Micro",
      description: "Build, validate, and atomically create or update a production Micro project.",
      inputSchema: directoryInput.extend({
        slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, slug }) => await invoke(["deploy", slug, "--json"], path),
  );

  server.registerTool(
    "micro_projects",
    {
      title: "List Micro projects",
      description: "List projects visible to the authenticated owner account.",
      inputSchema: z.object({}),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => await invoke(["projects", "--json"]),
  );

  server.registerTool(
    "micro_pull",
    {
      title: "Pull Micro source",
      description: "Fetch a project source snapshot and record its base revision in a new or empty local directory.",
      inputSchema: z.object({
        slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/),
        directory: z.string().optional(),
        path: z.string().optional().describe("Parent working directory"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ slug, directory, path }) =>
      await invoke(["pull", slug, ...(directory ? [directory] : []), "--json"], path),
  );

  server.registerTool(
    "micro_status",
    {
      title: "Inspect Micro status",
      description: "Read deployment, resource, usage, and health status for the linked project.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["status", "--json"], path),
  );

  server.registerTool(
    "micro_logs",
    {
      title: "Read bounded Micro logs",
      description: "Read a bounded recent log window for the linked project.",
      inputSchema: directoryInput.extend({
        since: z.string().regex(/^\d+[mhd]$/).default("30m"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, since }) => await invoke(["logs", "--since", since, "--json"], path),
  );

  server.registerTool(
    "micro_deployments",
    {
      title: "List Micro deployments",
      description: "List immutable deployment history for the linked project.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["deployments", "--json"], path),
  );

  server.registerTool(
    "micro_products",
    {
      title: "List Micro products",
      description: "List stable product resources for the linked project.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["products", "--json"], path),
  );

  server.registerTool(
    "micro_products_sync",
    {
      title: "Synchronize Micro products",
      description: "Create or update declared products without deleting omitted remote products.",
      inputSchema: directoryInput.extend({ acceptPriceChanges: z.boolean().default(false) }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, acceptPriceChanges }) =>
      await invoke(["products", "sync", ...(acceptPriceChanges ? ["--accept-price-changes"] : []), "--json"], path),
  );

  server.registerTool(
    "micro_files",
    {
      title: "List Micro protected files",
      description: "List protected and public storage resources for the linked project without downloading contents.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["files", "--json"], path),
  );

  server.registerTool(
    "micro_file_upload",
    {
      title: "Upload a Micro file",
      description: "Upload one explicit file as a stable storage resource with public or entitlement-gated access.",
      inputSchema: directoryInput.extend({
        id: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62})$/),
        source: z.string().min(1),
        public: z.boolean().default(false),
        entitlement: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62})$/).optional(),
      }).refine((value) => value.public !== Boolean(value.entitlement), {
        message: "Choose exactly one of public or entitlement access",
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, id, source, public: isPublic, entitlement }) =>
      await invoke([
        "files", "upload", id, source,
        ...(isPublic ? ["--public"] : ["--entitlement", entitlement!]),
        "--json",
      ], path),
  );

  server.registerTool(
    "micro_rollback",
    {
      title: "Roll back Micro code",
      description: "Activate a previous deployment without changing app users, records, products, purchases, or files.",
      inputSchema: directoryInput.extend({ deployment: z.string().uuid() }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, deployment }) => await invoke(["rollback", deployment, "--json"], path),
  );

  return server;
}
