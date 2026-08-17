# Security

Report vulnerabilities privately through GitHub Security Advisories for `AndreBaltazar8/micro-mcp`.

The MCP server never accepts passwords, refresh tokens, provider credentials, raw sessions, or permanent deployment tokens. It executes `micro` directly without a shell, bounds command time and output, and relies on the CLI's authenticated owner session and server-side authorization.

Review any mutating tool call before approval. Treat a compromised project repository, `micro` executable, Node dependency, or coding harness as a local-code execution risk.
