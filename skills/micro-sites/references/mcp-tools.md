# MCP tools

Use typed tools when installed; use the same CLI commands directly otherwise.

Read-only tools:

- `micro_doctor`: CLI version and owner account status.
- `micro_projects`: visible owner projects.
- `micro_status`: linked project, resources, usage, and health.
- `micro_logs`: bounded recent project logs.
- `micro_dev_status`: bounded status and logs for the MCP-managed local runner.
- `micro_deployments`: immutable deployment history.
- `micro_users`: bounded app-user metadata for owner-authorized diagnosis.
- `micro_records`: bounded project records; treat values as private user data.
- `micro_purchases`: normalized purchase state without card data or provider credentials.
- `micro_github_bindings`: active repository, ref, environment, workflow, and immutable identity bindings.
- `micro_products`: stable project products.
- `micro_files`: file metadata without protected content.

Mutating tools:

- `micro_build`: compile, normalize, and validate local source; writes local `.micro/` output only.
- `micro_dev_start` / `micro_dev_stop`: manage one loopback-only disposable runner per project.
- `micro_preview`: upload an opaque remote preview without a slug claim.
- `micro_deploy`: atomically create/update production code.
- `micro_github_link`: create an owner-approved OIDC deployment binding and write non-secret `micro.github.json`.
- `micro_github_revoke`: revoke one explicit binding and invalidate its outstanding deployment tokens.
- `micro_pull`: materialize a source snapshot and remote base revision locally.
- `micro_products_sync`: non-destructively synchronize `micro.yaml` products.
- `micro_file_upload`: upload one explicit public or entitlement-gated object.
- `micro_rollback`: activate a prior code deployment without mutating persistent project state.

Inspect `ok`, `exitCode`, `stdout`, `stderr`, and `json`. Treat `isError` or `ok: false` as failure even if diagnostics contain a URL or partial result. Feed exact diagnostics into the repair loop.

User, record, and purchase results can contain personal or customer data. Read
them only for a concrete owner-authorized maintenance task, minimize what enters
the harness context, and never copy full datasets into a report.

No tool accepts passwords, refresh tokens, provider keys, raw sessions, GitHub
OIDC assertions, or permanent deployment tokens. The GitHub Action performs its
own OIDC exchange; do not pass workflow identity through an MCP call. When a
secure owner interaction is required, stop the MCP workflow and use interactive
CLI/browser handoff.

`acceptPriceChanges` and `acceptLiveProducts` are separate commercial
confirmations on deploy and product sync tools. Set `acceptLiveProducts` only
after the owner has explicitly reviewed that the affected product will create
real Stripe charges.
