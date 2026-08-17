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
      "micro_projects",
      "micro_pull",
      "micro_status",
      "micro_logs",
      "micro_deployments",
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
  } finally {
    await client.close();
  }
});
