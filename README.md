# Micro skill and MCP server

The official agent-facing package for [Micro](https://micro.do). It teaches a coding harness how to build, verify, preview, deploy, diagnose, update, and roll back a full-stack Micro, then exposes the same operations as typed local MCP tools backed by `micro-cli`.

Micro does not receive prompts or call a model. The skill runs in the creator's existing harness; the MCP server invokes the public CLI without handling passwords or provider secrets.

## Install

Install the skill directly from this repository, or configure the bundled stdio server:

```json
{
  "mcpServers": {
    "micro": {
      "command": "npx",
      "args": ["-y", "@andrebaltazar/micro-mcp@0.3.0"]
    }
  }
}
```

Install a compatible `micro` executable first and authenticate interactively. Set `MICRO_CLI` only when the executable is not on `PATH`; it must be an executable path, never a shell command.

For repository deployment, use `micro_github_link` once from an authenticated
owner workstation, commit the generated non-secret `micro.github.json`, and
deploy through the first-party
[`AndreBaltazar8/micro-action`](https://github.com/AndreBaltazar8/micro-action).
The Action uses GitHub OIDC; no long-lived Micro credential belongs in GitHub.

For destructive project retirement, inspect and export the linked project first,
then use `micro_project_delete` with its exact slug and `confirm: true`. Track the
asynchronous cleanup with `micro_project_deletions`; local source is never removed.

For record recovery, inspect `micro_backups` immediately before acting. A restore
requires the exact backup digest and fresh current-record digest; it replaces
records only and never rewinds users, purchases, entitlements, products, files,
deployments, or local source.

Project operation tools cover roles and invitations, private visibility,
custom-domain proof, plan usage, spending caps, and hosted platform billing.
Invitation acceptance and private-grant creation intentionally remain secure CLI
handoffs so bearer tokens never enter MCP or model context.

## Develop

```sh
npm ci
npm run check
npm run build
npm test
```

The package uses MCP 2026-07-28 through the stable TypeScript SDK v2 stdio entry and also serves legacy clients through SDK negotiation.

<!-- mcp-name: io.github.AndreBaltazar8/micro-mcp -->
