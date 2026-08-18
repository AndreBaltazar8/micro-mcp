import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

test("publishes bounded tools and invokes the CLI without a shell", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "micro-mcp-test-"));
  const executable = join(fixture, "micro-fixture");
  await writeFile(
    executable,
    "#!/bin/sh\nprintf '{\"args\":['\nfirst=1\nfor argument in \"$@\"; do\n  if [ $first -eq 0 ]; then printf ','; fi\n  first=0\n  escaped=$(printf '%s' \"$argument\" | sed 's/\\\\/\\\\\\\\/g; s/\"/\\\\\"/g')\n  printf '\"%s\"' \"$escaped\"\ndone\nprintf ']}\\n'\n",
  );
  await chmod(executable, 0o700);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("dist/src/index.js")],
    env: { ...process.env, MICRO_CLI: executable },
    stderr: "pipe",
  });
  const client = new Client(
    { name: "micro-mcp-test", version: "0.1.0" },
    { versionNegotiation: { mode: "auto" } },
  );
  try {
    await client.connect(transport);
    const listing = await client.listTools();
    const names = listing.tools.map((tool) => tool.name);
    assert.deepEqual(names, [
      "micro_doctor",
      "micro_build",
      "micro_dev_start",
      "micro_dev_status",
      "micro_dev_stop",
      "micro_preview",
      "micro_deploy",
      "micro_github_link",
      "micro_github_bindings",
      "micro_github_revoke",
      "micro_projects",
      "micro_project_deletions",
      "micro_project_delete",
      "micro_pull",
      "micro_status",
      "micro_logs",
      "micro_deployments",
      "micro_users",
      "micro_user_disable",
      "micro_user_enable",
      "micro_user_sessions_revoke",
      "micro_records",
      "micro_record_delete",
      "micro_backups",
      "micro_backup_create",
      "micro_backup_restore",
      "micro_backup_delete",
      "micro_purchases",
      "micro_audit",
      "micro_export_manifest",
      "micro_export_page",
      "micro_retention",
      "micro_retention_set",
      "micro_retention_prune",
      "micro_products",
      "micro_products_sync",
      "micro_files",
      "micro_file_upload",
      "micro_rollback",
    ]);
    assert.equal(JSON.stringify(listing).includes("password"), false);

    const projectDeletions = await client.callTool({
      name: "micro_project_deletions",
      arguments: {},
    });
    assert.equal(projectDeletions.isError, false);
    const projectDeletionsOutput = projectDeletions.structuredContent as { json?: unknown };
    assert.deepEqual(projectDeletionsOutput.json, {
      args: ["project", "deletions", "--json"],
    });

    const projectDeleted = await client.callTool({
      name: "micro_project_delete",
      arguments: { path: fixture, slug: "paid-example", confirm: true },
    });
    assert.equal(projectDeleted.isError, false);
    const projectDeletedOutput = projectDeleted.structuredContent as { json?: unknown };
    assert.deepEqual(projectDeletedOutput.json, {
      args: [
        "project", "delete", "--confirm-slug", "paid-example", "--confirm", "--json",
      ],
    });

    const projectDeleteUnconfirmed = await client.callTool({
      name: "micro_project_delete",
      arguments: { path: fixture, slug: "paid-example", confirm: false },
    });
    assert.equal(projectDeleteUnconfirmed.isError, true);

    const response = await client.callTool({
      name: "micro_build",
      arguments: { path: fixture },
    });
    assert.equal(response.isError, false);
    assert.deepEqual(response.structuredContent, {
      ok: true,
      command: ["micro", "build", "--json"],
      exitCode: 0,
      stdout: '{"args":["build","--json"]}',
      stderr: "",
      json: { args: ["build", "--json"] },
    });

    const commercial = await client.callTool({
      name: "micro_deploy",
      arguments: {
        path: fixture,
        slug: "paid-example",
        acceptPriceChanges: true,
        acceptLiveProducts: true,
      },
    });
    assert.equal(commercial.isError, false);
    const commercialOutput = commercial.structuredContent as { json?: unknown };
    assert.deepEqual(commercialOutput.json, {
      args: ["deploy", "paid-example", "--accept-price-changes", "--accept-live-products", "--json"],
    });

    const disabled = await client.callTool({
      name: "micro_user_disable",
      arguments: {
        path: fixture,
        user: "11111111-1111-4111-8111-111111111111",
        confirm: true,
      },
    });
    assert.equal(disabled.isError, false);
    const disabledOutput = disabled.structuredContent as { json?: unknown };
    assert.deepEqual(disabledOutput.json, {
      args: [
        "users", "disable", "11111111-1111-4111-8111-111111111111",
        "--confirm", "--json",
      ],
    });

    const enabled = await client.callTool({
      name: "micro_user_enable",
      arguments: { path: fixture, user: "11111111-1111-4111-8111-111111111111" },
    });
    assert.equal(enabled.isError, false);
    const enabledOutput = enabled.structuredContent as { json?: unknown };
    assert.deepEqual(enabledOutput.json, {
      args: ["users", "enable", "11111111-1111-4111-8111-111111111111", "--json"],
    });

    const revoked = await client.callTool({
      name: "micro_user_sessions_revoke",
      arguments: {
        path: fixture,
        user: "11111111-1111-4111-8111-111111111111",
        confirm: true,
      },
    });
    assert.equal(revoked.isError, false);
    const revokedOutput = revoked.structuredContent as { json?: unknown };
    assert.deepEqual(revokedOutput.json, {
      args: [
        "users", "revoke-sessions", "11111111-1111-4111-8111-111111111111",
        "--confirm", "--json",
      ],
    });

    const unconfirmed = await client.callTool({
      name: "micro_user_disable",
      arguments: {
        path: fixture,
        user: "11111111-1111-4111-8111-111111111111",
        confirm: false,
      },
    });
    assert.equal(unconfirmed.isError, true);

    const recordDeleted = await client.callTool({
      name: "micro_record_delete",
      arguments: {
        path: fixture,
        environment: "production",
        collection: "notes",
        scope: "project",
        key: "welcome",
        version: 3,
        confirm: true,
      },
    });
    assert.equal(recordDeleted.isError, false);
    const recordDeletedOutput = recordDeleted.structuredContent as { json?: unknown };
    assert.deepEqual(recordDeletedOutput.json, {
      args: [
        "records", "delete", "production", "notes", "project", "welcome",
        "--version", "3", "--confirm", "--json",
      ],
    });

    const recordUnconfirmed = await client.callTool({
      name: "micro_record_delete",
      arguments: {
        path: fixture,
        environment: "production",
        collection: "notes",
        scope: "project",
        key: "welcome",
        version: 3,
        confirm: false,
      },
    });
    assert.equal(recordUnconfirmed.isError, true);

    const backups = await client.callTool({
      name: "micro_backups",
      arguments: { path: fixture },
    });
    assert.equal(backups.isError, false);
    const backupsOutput = backups.structuredContent as { json?: unknown };
    assert.deepEqual(backupsOutput.json, { args: ["backups", "--json"] });

    const backupCreated = await client.callTool({
      name: "micro_backup_create",
      arguments: { path: fixture, confirm: true },
    });
    assert.equal(backupCreated.isError, false);
    const backupCreatedOutput = backupCreated.structuredContent as { json?: unknown };
    assert.deepEqual(backupCreatedOutput.json, {
      args: ["backups", "create", "--confirm", "--json"],
    });

    const backupCreateUnconfirmed = await client.callTool({
      name: "micro_backup_create",
      arguments: { path: fixture, confirm: false },
    });
    assert.equal(backupCreateUnconfirmed.isError, true);

    const backupId = "11111111-1111-4111-8111-111111111111";
    const backupSha256 = "a".repeat(64);
    const currentSha256 = "b".repeat(64);
    const backupRestored = await client.callTool({
      name: "micro_backup_restore",
      arguments: {
        path: fixture,
        backupId,
        backupSha256,
        expectedCurrentSha256: currentSha256,
        confirm: true,
      },
    });
    assert.equal(backupRestored.isError, false);
    const backupRestoredOutput = backupRestored.structuredContent as { json?: unknown };
    assert.deepEqual(backupRestoredOutput.json, {
      args: [
        "backups", "restore", backupId, "--backup-sha256", backupSha256,
        "--expected-current-sha256", currentSha256, "--confirm", "--json",
      ],
    });

    const backupRestoreUnconfirmed = await client.callTool({
      name: "micro_backup_restore",
      arguments: {
        path: fixture,
        backupId,
        backupSha256,
        expectedCurrentSha256: currentSha256,
        confirm: false,
      },
    });
    assert.equal(backupRestoreUnconfirmed.isError, true);

    const backupDeleted = await client.callTool({
      name: "micro_backup_delete",
      arguments: { path: fixture, backupId, sha256: backupSha256, confirm: true },
    });
    assert.equal(backupDeleted.isError, false);
    const backupDeletedOutput = backupDeleted.structuredContent as { json?: unknown };
    assert.deepEqual(backupDeletedOutput.json, {
      args: [
        "backups", "delete", backupId, "--sha256", backupSha256,
        "--confirm", "--json",
      ],
    });

    const backupDeleteUnconfirmed = await client.callTool({
      name: "micro_backup_delete",
      arguments: { path: fixture, backupId, sha256: backupSha256, confirm: false },
    });
    assert.equal(backupDeleteUnconfirmed.isError, true);

    const manifest = await client.callTool({
      name: "micro_export_manifest",
      arguments: { path: fixture },
    });
    assert.equal(manifest.isError, false);
    const manifestOutput = manifest.structuredContent as { json?: unknown };
    assert.deepEqual(manifestOutput.json, { args: ["export", "--json"] });

    const exportPage = await client.callTool({
      name: "micro_export_page",
      arguments: { path: fixture, resource: "records", limit: 50, offset: 100 },
    });
    assert.equal(exportPage.isError, false);
    const exportPageOutput = exportPage.structuredContent as { json?: unknown };
    assert.deepEqual(exportPageOutput.json, {
      args: ["export", "records", "--limit", "50", "--offset", "100", "--json"],
    });

    const retention = await client.callTool({
      name: "micro_retention",
      arguments: { path: fixture },
    });
    assert.equal(retention.isError, false);
    const retentionOutput = retention.structuredContent as { json?: unknown };
    assert.deepEqual(retentionOutput.json, { args: ["retention", "--json"] });

    const retentionSet = await client.callTool({
      name: "micro_retention_set",
      arguments: { path: fixture, recordDays: 90, automatic: true, confirm: true },
    });
    assert.equal(retentionSet.isError, false);
    const retentionSetOutput = retentionSet.structuredContent as { json?: unknown };
    assert.deepEqual(retentionSetOutput.json, {
      args: [
        "retention", "set", "--record-days", "90", "--automatic", "--confirm", "--json",
      ],
    });

    const retentionSetUnconfirmed = await client.callTool({
      name: "micro_retention_set",
      arguments: { path: fixture, recordDays: 90, automatic: true, confirm: false },
    });
    assert.equal(retentionSetUnconfirmed.isError, true);

    const invalidAutomaticRetention = await client.callTool({
      name: "micro_retention_set",
      arguments: { path: fixture, recordDays: 0, automatic: true, confirm: true },
    });
    assert.equal(invalidAutomaticRetention.isError, true);

    const retentionPrune = await client.callTool({
      name: "micro_retention_prune",
      arguments: { path: fixture, expectedRecords: 12, confirm: true },
    });
    assert.equal(retentionPrune.isError, false);
    const retentionPruneOutput = retentionPrune.structuredContent as { json?: unknown };
    assert.deepEqual(retentionPruneOutput.json, {
      args: [
        "retention", "prune", "--expected-records", "12", "--confirm", "--json",
      ],
    });

    const retentionPruneUnconfirmed = await client.callTool({
      name: "micro_retention_prune",
      arguments: { path: fixture, expectedRecords: 12, confirm: false },
    });
    assert.equal(retentionPruneUnconfirmed.isError, true);
  } finally {
    await client.close();
  }
});
