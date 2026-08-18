# Deployment and maintenance

Before changing a live project:

```sh
micro status --json
micro deployments --json
micro logs --since 30m --json
```

When the issue involves persistent state, inspect only the bounded surface that
is actually relevant:

```sh
micro users --json
micro records --json
micro purchases --json
micro audit --json
```

These commands are owner-only and may return personal data. Do not use them for
routine deployment checks or reproduce unrelated records in model output.

For an owner-authorized app-user access incident, select the exact UUID from the
bounded user list, state the consequence, and require explicit confirmation for
access-revoking operations:

```sh
micro users disable USER_ID --confirm --json
micro users enable USER_ID --json
micro users revoke-sessions USER_ID --confirm --json
```

Disablement and session revocation preserve records, purchases, and
entitlements. Disablement also consumes active recovery and verification links;
enabling restores sign-in eligibility but does not create a session.

Delete a project record only from a freshly inspected result. Preserve its
environment, collection, scope, key, and version exactly:

```sh
micro records --json
micro records delete production notes project welcome --version 3 --confirm --json
```

A version conflict means the value changed; inspect it again instead of
automatically retrying the permanent deletion.

For a bounded owner export, read the manifest and walk each required live page:

```sh
micro export --json
micro export records --limit 100 --offset 0 --json
```

Pages are not a transactional snapshot. Compare totals after the final page,
report changes, and keep customer data out of ordinary harness output.

Project-record retention defaults to keep forever. Inspect the fresh policy and
preview before proposing a change or prune:

```sh
micro retention --json
micro retention set --record-days 90 --automatic --confirm --json
micro retention prune --expected-records 12 --confirm --json
```

Use `0` only for keep forever; finite policies allow 30 through 3650 days.
Automatic pruning is opt-in and runs at most daily. A prune must use the exact
eligible count from the immediately preceding preview. If the policy or count
changed, inspect again and obtain fresh confirmation—never retry a conflict
automatically. This policy only removes aged project records; purchases and
entitlements are always preserved.

Use transactional record backups for an exact record-set recovery point:

```sh
micro backups --json
micro backups create --confirm --json
micro backups restore BACKUP_ID --backup-sha256 BACKUP_SHA --expected-current-sha256 CURRENT_SHA --confirm --json
micro backups delete BACKUP_ID --sha256 BACKUP_SHA --confirm --json
```

Inspect `micro backups` immediately before restore or deletion and copy the
digests exactly. Restore replaces all current records and fails if either the
backup or current set changed. Never retry that conflict automatically. These
snapshots do not include users, purchases, entitlements, products, protected
files, deployments, or local source; describe them as record backups, not full
project backups.

Before permanently deleting a project, read its fresh linked status, export
anything the owner needs, and state that project records, purchases,
entitlements, deployments, app users, and protected files will all be removed:

```sh
micro status --json
micro export --json
micro project delete --confirm-slug EXACT_LINKED_SLUG --confirm --json
micro project deletions --json
```

The confirmed request hides the project from the runner immediately and holds
the slug for 30 days. Physical protected-object cleanup is asynchronous; keep
the returned receipt until it reaches `complete`. A `failed` receipt requires
inspection and fresh owner confirmation before issuing the same exact deletion
command as a retry. Never retry it automatically. Local source is deliberately
left untouched.

Compare local base revision with remote state. If remote source changed, pull and review it; do not overwrite silently. Build, test, preview, deploy, then check the exact live URL and relevant user journey.

Rollback changes code only:

```sh
micro rollback DEPLOYMENT_ID --json
```

Verify that the active deployment changed and that users, records, purchases, entitlements, and files did not roll back.

For GitHub deployment, link the immutable repository identity, intended ref or protected environment, and project/slug from a secure owner session:

```sh
micro github link \
  --repository OWNER/REPOSITORY \
  --environment production \
  --ref refs/heads/main \
  --slug preset-shop
```

Commit the generated `micro.github.json`. It contains the public binding ID and
the exact policy facts, not a credential. The binding alone neither creates a
project nor claims a slug; the first validated Action deployment does both
atomically.

Use `AndreBaltazar8/micro-action` with `contents: read` and `id-token: write`,
and put the job in the linked GitHub environment. Pin the Action to a full
commit SHA in production. Do not create a permanent deploy secret: the Action
exchanges GitHub OIDC for a five-minute, binding-scoped token that can activate
one deployment. Pull-request event identities are rejected.

Review or revoke authorization explicitly:

```sh
micro github bindings --json
micro github revoke BINDING_ID --json
```
