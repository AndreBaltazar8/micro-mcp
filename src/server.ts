import { McpServer } from "@modelcontextprotocol/server";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

async function invokeScheduleSet(
  path: string | undefined,
  scheduleId: string,
  everyMinutes: number,
  payload: Record<string, unknown>,
  enabled: boolean,
) {
  const directory = await mkdtemp(join(tmpdir(), "micro-schedule-"));
  const payloadFile = join(directory, "payload.json");
  try {
    await writeFile(payloadFile, JSON.stringify(payload), { mode: 0o600 });
    return await invoke([
      "schedules", "set", scheduleId, "--every-minutes", String(everyMinutes),
      "--payload-file", payloadFile, ...(enabled ? [] : ["--disabled"]), "--json",
    ], path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: "micro-mcp", version: "0.4.1" },
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
    "micro_plans",
    {
      title: "List Micro plans",
      description: "List the public Micro plan catalog and current usage allowances.",
      inputSchema: z.object({}),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => await invoke(["plans", "--json"]),
  );

  server.registerTool(
    "micro_usage",
    {
      title: "Inspect Micro account usage",
      description: "Read authenticated account plan, monthly usage, daily runner usage, and spending-cap state.",
      inputSchema: z.object({}),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => await invoke(["usage", "--json"]),
  );

  server.registerTool(
    "micro_spending_cap_set",
    {
      title: "Set Micro spending cap",
      description: "Replace the account monthly usage cap and warning threshold. A hard cap may stop requests when exhausted.",
      inputSchema: z.object({
        monthlyCents: z.number().int().min(0).max(1000000),
        warningPercent: z.number().int().min(1).max(100),
        hardStop: z.boolean().default(true),
        confirm: z.literal(true).describe("Explicit confirmation to replace the current account spending-cap policy"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ monthlyCents, warningPercent, hardStop }) =>
      await invoke([
        "spending-cap", "set", "--monthly-cents", String(monthlyCents),
        "--warning-percent", String(warningPercent), ...(hardStop ? [] : ["--soft"]), "--json",
      ]),
  );

  server.registerTool(
    "micro_spending_cap_delete",
    {
      title: "Remove Micro spending cap",
      description: "Remove the authenticated account spending cap after inspecting current usage and policy.",
      inputSchema: z.object({
        confirm: z.literal(true).describe("Explicit confirmation to remove the account spending cap"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async () => await invoke(["spending-cap", "delete", "--confirm", "--json"]),
  );

  server.registerTool(
    "micro_billing",
    {
      title: "Inspect Micro billing",
      description: "Read the authenticated account subscription state without exposing payment credentials or card data.",
      inputSchema: z.object({}),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => await invoke(["billing", "--json"]),
  );

  server.registerTool(
    "micro_billing_checkout",
    {
      title: "Create Micro billing checkout",
      description: "Create a hosted checkout session for one inspected Micro plan. This does not accept payment credentials.",
      inputSchema: z.object({
        plan: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62})$/),
        confirm: z.literal(true).describe("Explicit confirmation to create checkout for this plan"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ plan }) => await invoke(["billing", "checkout", plan, "--json"]),
  );

  server.registerTool(
    "micro_billing_portal",
    {
      title: "Create Micro billing portal",
      description: "Create a hosted Stripe billing-management session for the authenticated account.",
      inputSchema: z.object({}),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async () => await invoke(["billing", "portal", "--json"]),
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
    "micro_settings",
    {
      title: "Inspect Micro project settings",
      description: "Read the linked project's visibility and authenticated caller authority.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["settings", "--json"], path),
  );

  server.registerTool(
    "micro_visibility_set",
    {
      title: "Set Micro project visibility",
      description: "Make the linked site public or require authenticated app access and explicit private grants.",
      inputSchema: directoryInput.extend({
        visibility: z.enum(["public", "private"]),
        confirm: z.literal(true).describe("Explicit confirmation to change live project visibility"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, visibility }) =>
      await invoke(["settings", "visibility", visibility, "--confirm", "--json"], path),
  );

  server.registerTool(
    "micro_members",
    {
      title: "List Micro project members",
      description: "List the linked project's owner and delegated members, roles, and promotion authority.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["members", "--json"], path),
  );

  server.registerTool(
    "micro_member_set",
    {
      title: "Set Micro project member",
      description: "Add or replace one existing account's project role. Viewers can never receive promotion authority.",
      inputSchema: directoryInput.extend({
        email: z.string().email().max(320),
        role: z.enum(["viewer", "developer", "admin"]),
        canPromote: z.boolean().default(false),
        confirm: z.literal(true).describe("Explicit confirmation to grant or replace this account's project access"),
      }).refine((value) => value.role !== "viewer" || !value.canPromote, {
        message: "Viewers cannot promote deployments",
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, email, role, canPromote }) =>
      await invoke([
        "members", "set", email, role, ...(canPromote ? ["--can-promote"] : []), "--json",
      ], path),
  );

  server.registerTool(
    "micro_member_remove",
    {
      title: "Remove Micro project member",
      description: "Revoke one exact non-owner account's access to the linked project.",
      inputSchema: directoryInput.extend({
        accountId: z.string().uuid(),
        confirm: z.literal(true).describe("Explicit confirmation to revoke this account's project access"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, accountId }) =>
      await invoke(["members", "remove", accountId, "--confirm", "--json"], path),
  );

  server.registerTool(
    "micro_invitations",
    {
      title: "List Micro project invitations",
      description: "List bounded invitation metadata without exposing acceptance tokens.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["invitations", "--json"], path),
  );

  server.registerTool(
    "micro_invitation_create",
    {
      title: "Invite a Micro project member",
      description: "Email one single-use project invitation with an explicit role and optional promotion authority.",
      inputSchema: directoryInput.extend({
        email: z.string().email().max(320),
        role: z.enum(["viewer", "developer", "admin"]),
        canPromote: z.boolean().default(false),
        confirm: z.literal(true).describe("Explicit confirmation to send this project invitation email"),
      }).refine((value) => value.role !== "viewer" || !value.canPromote, {
        message: "Viewers cannot promote deployments",
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, email, role, canPromote }) =>
      await invoke([
        "invitations", "create", email, role, ...(canPromote ? ["--can-promote"] : []), "--json",
      ], path),
  );

  server.registerTool(
    "micro_invitation_revoke",
    {
      title: "Revoke Micro project invitation",
      description: "Revoke one exact pending project invitation before it is accepted.",
      inputSchema: directoryInput.extend({
        invitationId: z.string().uuid(),
        confirm: z.literal(true).describe("Explicit confirmation to revoke this invitation"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, invitationId }) =>
      await invoke(["invitations", "revoke", invitationId, "--confirm", "--json"], path),
  );

  server.registerTool(
    "micro_domains",
    {
      title: "List Micro custom domains",
      description: "List the linked project's custom domains and DNS proof state.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["domains", "--json"], path),
  );

  server.registerTool(
    "micro_domain_add",
    {
      title: "Add Micro custom domain",
      description: "Register one normalized hostname and return the DNS ownership proof that must be published.",
      inputSchema: directoryInput.extend({
        hostname: z.string().regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, hostname }) => await invoke(["domains", "add", hostname, "--json"], path),
  );

  server.registerTool(
    "micro_domain_verify",
    {
      title: "Verify Micro custom domain",
      description: "Check the exact domain's DNS proof and activate it only when ownership resolves correctly.",
      inputSchema: directoryInput.extend({
        domainId: z.string().uuid(),
        confirm: z.literal(true).describe("Explicit confirmation to verify and activate this custom domain"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, domainId }) =>
      await invoke(["domains", "verify", domainId, "--json"], path),
  );

  server.registerTool(
    "micro_domain_remove",
    {
      title: "Remove Micro custom domain",
      description: "Remove one exact custom domain from the linked project.",
      inputSchema: directoryInput.extend({
        domainId: z.string().uuid(),
        confirm: z.literal(true).describe("Explicit confirmation to stop serving this custom domain"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, domainId }) =>
      await invoke(["domains", "remove", domainId, "--confirm", "--json"], path),
  );

  server.registerTool(
    "micro_private_grants",
    {
      title: "List Micro private access grants",
      description: "List bounded private-site grant metadata without exposing bearer tokens.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["private-grants", "--json"], path),
  );

  server.registerTool(
    "micro_private_grant_revoke",
    {
      title: "Revoke Micro private access grant",
      description: "Revoke one exact private-site bearer grant. Token creation remains a secure CLI handoff.",
      inputSchema: directoryInput.extend({
        grantId: z.string().uuid(),
        confirm: z.literal(true).describe("Explicit confirmation to revoke this private access grant"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, grantId }) =>
      await invoke(["private-grants", "revoke", grantId, "--confirm", "--json"], path),
  );

  server.registerTool(
    "micro_schedules",
    {
      title: "List Micro schedules",
      description: "List durable authenticated schedule events and their latest delivery state for the linked project.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["schedules", "--json"], path),
  );

  server.registerTool(
    "micro_emails",
    {
      title: "List Micro project email deliveries",
      description: "List owner-only delivery status and daily quota usage for verified-user project notifications. Message bodies and provider credentials are never returned.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["emails", "--json"], path),
  );

  server.registerTool(
    "micro_schedule_set",
    {
      title: "Set Micro schedule",
      description: "Create or replace one interval schedule. Its bounded object payload is non-secret configuration delivered to the active production Wasm deployment.",
      inputSchema: directoryInput.extend({
        scheduleId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
        everyMinutes: z.number().int().min(5).max(10080),
        payload: z.record(z.string(), z.unknown()).default({}),
        enabled: z.boolean().default(true),
        confirm: z.literal(true).describe("Explicit confirmation to create or replace this schedule"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, scheduleId, everyMinutes, payload, enabled }) =>
      await invokeScheduleSet(path, scheduleId, everyMinutes, payload, enabled),
  );

  server.registerTool(
    "micro_schedule_run",
    {
      title: "Run Micro schedule now",
      description: "Enqueue one additional authenticated schedule event for the active production Wasm deployment.",
      inputSchema: directoryInput.extend({
        scheduleId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
        confirm: z.literal(true).describe("Explicit confirmation to enqueue this schedule now"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, scheduleId }) =>
      await invoke(["schedules", "run", scheduleId, "--confirm", "--json"], path),
  );

  server.registerTool(
    "micro_schedule_remove",
    {
      title: "Remove Micro schedule",
      description: "Remove one exact schedule and cancel its pending or retryable deliveries.",
      inputSchema: directoryInput.extend({
        scheduleId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
        confirm: z.literal(true).describe("Explicit confirmation to remove this schedule"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, scheduleId }) =>
      await invoke(["schedules", "remove", scheduleId, "--confirm", "--json"], path),
  );

  server.registerTool(
    "micro_project_deletions",
    {
      title: "List Micro project-deletion receipts",
      description: "List durable project-deletion progress and failures for the authenticated owner account, including protected-object counts and slug release times.",
      inputSchema: z.object({}),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => await invoke(["project", "deletions", "--json"]),
  );

  server.registerTool(
    "micro_project_delete",
    {
      title: "Delete a linked Micro project",
      description: "Permanently delete the exact locally linked project. Hides it from the runner immediately, reserves the slug for 30 days, queues protected-object cleanup, and leaves local source untouched.",
      inputSchema: directoryInput.extend({
        slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/)
          .describe("Exact linked slug copied from a fresh micro_status result"),
        confirm: z.literal(true).describe("Explicit confirmation to permanently delete this project after exporting anything needed"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, slug }) =>
      await invoke([
        "project", "delete", "--confirm-slug", slug, "--confirm", "--json",
      ], path),
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
    "micro_backups",
    {
      title: "Inspect Micro record backups",
      description: "Read bounded transactional project-record backups plus the fresh digest of the current record set. Backups exclude users, purchases, entitlements, products, files, and deployments.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["backups", "--json"], path),
  );

  server.registerTool(
    "micro_backup_create",
    {
      title: "Create a Micro record backup",
      description: "Create a bounded transactional snapshot of the linked project's records. The snapshot excludes every authoritative identity, payment, entitlement, product, file, and deployment resource.",
      inputSchema: directoryInput.extend({
        confirm: z.literal(true).describe("Explicit confirmation to create a bounded record-only snapshot"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ path }) => await invoke(["backups", "create", "--confirm", "--json"], path),
  );

  server.registerTool(
    "micro_backup_restore",
    {
      title: "Restore a Micro record backup",
      description: "Replace all current project records with one exact inspected backup. Requires both the backup digest and a freshly inspected current-record digest, and never rewinds users, purchases, entitlements, products, files, or deployments.",
      inputSchema: directoryInput.extend({
        backupId: z.string().uuid().describe("Exact backup UUID from a fresh micro_backups result"),
        backupSha256: z.string().regex(/^[0-9a-f]{64}$/).describe("Exact digest of the selected backup"),
        expectedCurrentSha256: z.string().regex(/^[0-9a-f]{64}$/).describe("Fresh digest of the current record set that may be replaced"),
        confirm: z.literal(true).describe("Explicit confirmation to replace every current project record with this exact backup"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, backupId, backupSha256, expectedCurrentSha256 }) =>
      await invoke([
        "backups", "restore", backupId, "--backup-sha256", backupSha256,
        "--expected-current-sha256", expectedCurrentSha256, "--confirm", "--json",
      ], path),
  );

  server.registerTool(
    "micro_backup_delete",
    {
      title: "Delete a Micro record backup",
      description: "Permanently delete one exact record-only backup without changing current project data or local source.",
      inputSchema: directoryInput.extend({
        backupId: z.string().uuid().describe("Exact backup UUID from a fresh micro_backups result"),
        sha256: z.string().regex(/^[0-9a-f]{64}$/).describe("Exact digest of the selected backup"),
        confirm: z.literal(true).describe("Explicit confirmation to permanently delete this exact record backup"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, backupId, sha256 }) =>
      await invoke([
        "backups", "delete", backupId, "--sha256", sha256, "--confirm", "--json",
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
    "micro_export_manifest",
    {
      title: "Inspect Micro export manifest",
      description: "Read live project-data export resource counts and pagination limits. The manifest is not a transactional snapshot.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["export", "--json"], path),
  );

  server.registerTool(
    "micro_export_page",
    {
      title: "Export one bounded Micro data page",
      description: "Read one bounded live page of project users, records, purchases, entitlements, products, files, or audit events.",
      inputSchema: directoryInput.extend({
        resource: z.enum(["users", "records", "purchases", "entitlements", "products", "files", "audit"]),
        limit: z.number().int().min(1).max(100).default(100),
        offset: z.number().int().min(0).max(100000).default(0),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, resource, limit, offset }) =>
      await invoke([
        "export", resource, "--limit", String(limit), "--offset", String(offset), "--json",
      ], path),
  );

  server.registerTool(
    "micro_retention",
    {
      title: "Inspect Micro record retention",
      description: "Read the linked project's record-retention policy and exact live prune preview. Purchases and entitlements are excluded from retention.",
      inputSchema: directoryInput,
      outputSchema: cliOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => await invoke(["retention", "--json"], path),
  );

  server.registerTool(
    "micro_retention_set",
    {
      title: "Set Micro record retention",
      description: "Set keep-forever or a 30–3650 day project-record policy. Automatic pruning is opt-in; purchases and entitlements are never affected.",
      inputSchema: directoryInput.extend({
        recordDays: z.number().int().refine(
          (value) => value === 0 || (value >= 30 && value <= 3650),
          "Use 0 or a value from 30 through 3650",
        ),
        automatic: z.boolean().default(false),
        confirm: z.literal(true).describe("Explicit confirmation that this retention policy should replace the inspected policy"),
      }).refine((value) => !value.automatic || value.recordDays >= 30, {
        message: "Automatic pruning requires a finite policy",
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, recordDays, automatic }) =>
      await invoke([
        "retention", "set", "--record-days", String(recordDays),
        ...(automatic ? ["--automatic"] : []), "--confirm", "--json",
      ], path),
  );

  server.registerTool(
    "micro_retention_prune",
    {
      title: "Prune previewed Micro records",
      description: "Permanently prune the exact currently previewed count of aged project records. Fails if policy or eligible records changed; never affects purchases or entitlements.",
      inputSchema: directoryInput.extend({
        expectedRecords: z.number().int().min(0).max(10000),
        confirm: z.literal(true).describe("Explicit confirmation that the exact previewed record count should be permanently pruned"),
      }),
      outputSchema: cliOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, expectedRecords }) =>
      await invoke([
        "retention", "prune", "--expected-records", String(expectedRecords),
        "--confirm", "--json",
      ], path),
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
