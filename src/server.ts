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
        acceptPriceChanges: z.boolean().default(false),
        acceptLiveProducts: z.boolean().default(false),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, slug, acceptPriceChanges, acceptLiveProducts }) =>
      await invoke([
        "deploy", slug,
        ...(acceptPriceChanges ? ["--accept-price-changes"] : []),
        ...(acceptLiveProducts ? ["--accept-live-products"] : []),
        "--json",
      ], path),
  );

  server.registerTool(
    "micro_github_link",
    {
      title: "Authorize GitHub deployment",
      description: "Create an owner-approved OIDC binding and write the non-secret micro.github.json project identity file.",
      inputSchema: directoryInput.extend({
        repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
        environment: z.string().regex(/^[A-Za-z0-9_. -]{0,255}$/).default("production"),
        ref: z.string().regex(/^refs\/(heads|tags)\/.+$/),
        slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, repository, environment, ref, slug }) =>
      await invoke([
        "github", "link", "--repository", repository, "--environment", environment,
        "--ref", ref, "--slug", slug, "--json",
      ], path),
  );

  server.registerTool(
    "micro_github_bindings",
    {
      title: "List GitHub deployment bindings",
      description: "List active repository, ref, environment, workflow, and immutable identity bindings.",
      inputSchema: z.object({}),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => await invoke(["github", "bindings", "--json"]),
  );

  server.registerTool(
    "micro_github_revoke",
    {
      title: "Revoke GitHub deployment binding",
      description: "Revoke one explicit GitHub deployment binding and invalidate its outstanding deployment tokens.",
      inputSchema: z.object({ binding: z.string().uuid() }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ binding }) => await invoke(["github", "revoke", binding, "--json"]),
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
    "micro_users",
    {
      title: "Inspect Micro app users",
      description: "Read the latest bounded app-user metadata for the linked owner project. Results can contain personal data; disclose only what the maintenance task requires.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["users", "--json"], path),
  );

  server.registerTool(
    "micro_user_disable",
    {
      title: "Disable a Micro app user",
      description: "Disable one explicit app user while preserving records, purchases, and entitlements. Immediately revokes active sessions, recovery and verification links, and private download grants.",
      inputSchema: directoryInput.extend({
        user: z.string().uuid(),
        confirm: z.literal(true).describe("Explicit confirmation that this app user's access should be disabled"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, user }) =>
      await invoke(["users", "disable", user, "--confirm", "--json"], path),
  );

  server.registerTool(
    "micro_user_enable",
    {
      title: "Enable a Micro app user",
      description: "Restore sign-in access for one explicit disabled app user without creating a session.",
      inputSchema: directoryInput.extend({ user: z.string().uuid() }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, user }) => await invoke(["users", "enable", user, "--json"], path),
  );

  server.registerTool(
    "micro_user_sessions_revoke",
    {
      title: "Revoke Micro app-user sessions",
      description: "Revoke every active session and private download grant for one explicit app user without disabling the user.",
      inputSchema: directoryInput.extend({
        user: z.string().uuid(),
        confirm: z.literal(true).describe("Explicit confirmation that this app user's active sessions should be revoked"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, user }) =>
      await invoke(["users", "revoke-sessions", user, "--confirm", "--json"], path),
  );

  server.registerTool(
    "micro_records",
    {
      title: "Inspect Micro records",
      description: "Read the latest bounded project records for the linked owner project. Treat values as user data and do not copy them into prompts unless required.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["records", "--json"], path),
  );

  server.registerTool(
    "micro_record_delete",
    {
      title: "Delete an exact Micro record",
      description: "Permanently delete one exact project record using its environment, collection, scope, key, and inspected version. Fails if the record changed.",
      inputSchema: directoryInput.extend({
        environment: z.enum(["preview", "production"]),
        collection: z.string().regex(/^[a-z0-9._-]{1,48}$/),
        scope: z.union([
          z.literal("project"),
          z.string().regex(/^user:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
        ]),
        key: z.string().regex(/^[a-z0-9._-]{1,128}$/),
        version: z.number().int().positive().max(2147483647),
        confirm: z.literal(true).describe("Explicit confirmation that this exact record version should be permanently deleted"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, environment, collection, scope, key, version }) =>
      await invoke([
        "records", "delete", environment, collection, scope, key,
        "--version", String(version), "--confirm", "--json",
      ], path),
  );

  server.registerTool(
    "micro_purchases",
    {
      title: "Inspect Micro purchases",
      description: "Read the latest bounded normalized purchase ledger for the linked owner project without exposing payment credentials or card data.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["purchases", "--json"], path),
  );

  server.registerTool(
    "micro_audit",
    {
      title: "Inspect Micro owner activity",
      description: "Read the latest bounded owner audit events for the linked project without exposing credentials.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["audit", "--json"], path),
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
      inputSchema: directoryInput.extend({
        acceptPriceChanges: z.boolean().default(false),
        acceptLiveProducts: z.boolean().default(false),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, acceptPriceChanges, acceptLiveProducts }) =>
      await invoke([
        "products", "sync",
        ...(acceptPriceChanges ? ["--accept-price-changes"] : []),
        ...(acceptLiveProducts ? ["--accept-live-products"] : []),
        "--json",
      ], path),
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
