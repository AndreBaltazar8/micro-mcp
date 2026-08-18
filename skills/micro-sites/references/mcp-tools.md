# MCP tools

Use typed tools when installed; use the same CLI commands directly otherwise.

Read-only tools:

- `micro_doctor`: CLI version and owner account status.
- `micro_plans`: public plan catalog and allowances.
- `micro_usage`: authenticated plan, usage, and spending-cap state.
- `micro_billing`: authenticated subscription state without payment credentials.
- `micro_projects`: visible owner projects.
- `micro_settings`: linked project visibility and caller authority.
- `micro_members`: project membership, roles, and promotion grants.
- `micro_invitations`: invitation metadata without acceptance tokens.
- `micro_domains`: custom domains and DNS proof state.
- `micro_private_grants`: private-site grant metadata without bearer tokens.
- `micro_schedules`: durable schedule definitions and latest delivery state.
- `micro_emails`: owner-only delivery status and daily quota usage without message bodies.
- `micro_project_deletions`: durable project-deletion receipts, progress, failures, and slug release times.
- `micro_status`: linked project, resources, usage, and health.
- `micro_logs`: bounded recent project logs.
- `micro_dev_status`: bounded status and logs for the MCP-managed local runner.
- `micro_deployments`: immutable deployment history.
- `micro_users`: bounded app-user metadata for owner-authorized diagnosis.
- `micro_records`: bounded project records; treat values as private user data.
- `micro_backups`: transactional record-only snapshots and the fresh digest of the current record set.
- `micro_purchases`: normalized purchase state without card data or provider credentials.
- `micro_audit`: bounded owner activity for deployments, resources, payments, and automation.
- `micro_export_manifest`: live export resource counts and page limits.
- `micro_export_page`: one bounded live page of owner-authorized project data.
- `micro_retention`: current project-record policy and exact live prune preview.
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
- `micro_user_disable`: disable one explicit app user and revoke their active access; requires `confirm: true`.
- `micro_user_enable`: restore sign-in eligibility for one explicit disabled app user.
- `micro_user_sessions_revoke`: revoke one user's active sessions and private download grants without disabling them; requires `confirm: true`.
- `micro_record_delete`: permanently delete one exact record identity and inspected version; requires `confirm: true` and fails on a version race.
- `micro_backup_create`: create one bounded transactional record-only snapshot; requires `confirm: true`.
- `micro_backup_restore`: replace current records from one exact backup; requires the inspected backup digest, fresh current digest, and `confirm: true`.
- `micro_backup_delete`: permanently delete one exact backup; requires its inspected digest and `confirm: true`.
- `micro_retention_set`: replace the inspected keep-forever or finite record policy; requires `confirm: true`.
- `micro_retention_prune`: permanently prune the exact previewed aged-record count; requires `confirm: true` and `expectedRecords`.
- `micro_project_delete`: permanently delete the exact locally linked project; requires the fresh linked slug and `confirm: true`.
- `micro_spending_cap_set`: replace the account usage-cap policy; requires `confirm: true`.
- `micro_spending_cap_delete`: remove the account usage cap; requires `confirm: true`.
- `micro_billing_checkout`: create hosted checkout for one inspected plan; requires `confirm: true`.
- `micro_billing_portal`: create a hosted billing-management session.
- `micro_visibility_set`: replace linked project visibility; requires `confirm: true`.
- `micro_member_set`: add or replace one known account's project role; requires `confirm: true`.
- `micro_member_remove`: revoke one exact member; requires `confirm: true`.
- `micro_invitation_create`: send one role-bounded invitation email; requires `confirm: true`.
- `micro_invitation_revoke`: revoke one exact invitation; requires `confirm: true`.
- `micro_domain_add`: register one exact hostname and return its DNS proof.
- `micro_domain_verify`: verify and activate one inspected domain; requires `confirm: true`.
- `micro_domain_remove`: remove one exact custom domain; requires `confirm: true`.
- `micro_private_grant_revoke`: revoke one exact private-site grant; requires `confirm: true`.
- `micro_schedule_set`: create or replace one interval and non-secret object payload; requires `confirm: true`.
- `micro_schedule_run`: enqueue one additional event; requires `confirm: true` and is not idempotent.
- `micro_schedule_remove`: remove one schedule and cancel pending or retryable deliveries; requires `confirm: true`.

Inspect `ok`, `exitCode`, `stdout`, `stderr`, and `json`. Treat `isError` or `ok: false` as failure even if diagnostics contain a URL or partial result. Feed exact diagnostics into the repair loop.

User, record, and purchase results can contain personal or customer data. Read
them only for a concrete owner-authorized maintenance task, minimize what enters
the harness context, and never copy full datasets into a report.

Select an app user from `micro_users`; never guess or accept an unverified user
ID. Disabling preserves records, purchases, and entitlements but consumes active
recovery and verification links in addition to revoking sessions and private
download grants. Enabling does not mint a new session.

Select records from `micro_records` immediately before deletion and pass every
identity field plus the returned version to `micro_record_delete`. Never retry a
version conflict automatically: inspect the changed value and ask for fresh
confirmation. Record deletion is permanent and does not cascade to the owning
app user.

Read `micro_backups` immediately before any backup mutation. Creating a backup
captures at most 10,000 records and 32 MiB of JSON transactionally. Restoring
requires the selected `backup_id`, its `sha256`, and the fresh `current.sha256`;
it replaces the entire current record set. Deleting requires the same inspected
backup ID and digest. Never retry a digest or concurrency conflict automatically.
Backups intentionally exclude users, purchases, entitlements, products, files,
deployments, and local source, so use export and provider/storage recovery for
those resources instead of claiming a record backup is a full project backup.

Start a data export with `micro_export_manifest`, then request only the required
pages with `micro_export_page`. Pages are bounded but reflect live state rather
than one transactional snapshot; compare the last page totals with the manifest
and disclose if they changed. Exported users, records, purchases, and audit
metadata are private customer data—do not paste a complete export into model
output.

Read `micro_retention` immediately before either retention mutation. For a
policy change, explain that `recordDays: 0` keeps records forever and finite
policies allow 30–3650 days; set `automatic: true` only with explicit approval.
For pruning, pass the fresh `eligible_records` value as `expectedRecords`.
Never retry a policy/count conflict automatically. Retention cannot prune
purchases or entitlements.

Before `micro_project_delete`, call `micro_status`, export any required owner
data, explain that all project-owned data and files will be removed, and pass
the returned slug exactly. The tool leaves local source intact, hides the remote
project immediately, and returns an asynchronous durable receipt. Monitor it
with `micro_project_deletions`. A failed receipt must be inspected and presented
to the owner; never automatically call the deletion tool again, because the same
exact call explicitly retries failed cleanup.

No tool accepts passwords, refresh tokens, provider keys, raw sessions, GitHub
OIDC assertions, or permanent deployment tokens. The GitHub Action performs its
own OIDC exchange; do not pass workflow identity through an MCP call. When a
secure owner interaction is required, stop the MCP workflow and use interactive
CLI/browser handoff.

Read `micro_schedules` immediately before schedule mutation. Never put a secret,
bearer token, or user-private record into `payload`. Treat `micro_schedule_run`
as a new event on every successful invocation; do not retry it automatically
after an ambiguous transport failure. Event handlers must persist and dedupe
`x-micro-event-id` before applying side effects.

There is deliberately no MCP tool for invitation acceptance or private-grant
creation. Invitation and private-access bearer tokens must not enter model
context. Use `micro invitations accept --token-stdin` or a secure interactive
`micro private-grants create` handoff as described in `project-operation.md`.

`acceptPriceChanges` and `acceptLiveProducts` are separate commercial
confirmations on deploy and product sync tools. Set `acceptLiveProducts` only
after the owner has explicitly reviewed that the affected product will create
real Stripe charges.
