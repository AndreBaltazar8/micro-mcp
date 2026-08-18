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
      "micro_purchases",
      "micro_audit",
      "micro_products",
      "micro_products_sync",
      "micro_files",
      "micro_file_upload",
      "micro_rollback",
    ]);
    assert.equal(JSON.stringify(listing).includes("password"), false);

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
  } finally {
    await client.close();
  }
});
