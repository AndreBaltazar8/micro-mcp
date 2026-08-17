# MCP tools

Use typed tools when installed; use the same CLI commands directly otherwise.

Read-only tools:

- `micro_doctor`: CLI version and owner account status.
- `micro_projects`: visible owner projects.
- `micro_status`: linked project, resources, usage, and health.
- `micro_logs`: bounded recent project logs.

Mutating tools:

- `micro_build`: compile, normalize, and validate local source; writes local `.micro/` output only.
- `micro_preview`: upload an opaque remote preview without a slug claim.
- `micro_deploy`: atomically create/update production code.
- `micro_rollback`: activate a prior code deployment without mutating persistent project state.

Inspect `ok`, `exitCode`, `stdout`, `stderr`, and `json`. Treat `isError` or `ok: false` as failure even if diagnostics contain a URL or partial result. Feed exact diagnostics into the repair loop.

No tool accepts passwords, refresh tokens, provider keys, raw sessions, or permanent deployment tokens. When a secure owner interaction is required, stop the MCP workflow and use interactive CLI/browser handoff.
