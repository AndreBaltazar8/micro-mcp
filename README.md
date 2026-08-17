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
      "args": ["-y", "@andrebaltazar8/micro-mcp@0.1.0"]
    }
  }
}
```

Install a compatible `micro` executable first and authenticate interactively. Set `MICRO_CLI` only when the executable is not on `PATH`; it must be an executable path, never a shell command.

## Develop

```sh
npm ci
npm run check
npm run build
npm test
```

The package uses MCP 2026-07-28 through the stable TypeScript SDK v2 stdio entry and also serves legacy clients through SDK negotiation.

<!-- mcp-name: io.github.AndreBaltazar8/micro-mcp -->
