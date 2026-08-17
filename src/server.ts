import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { type CliResult, runMicro } from "./cli.js";

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
