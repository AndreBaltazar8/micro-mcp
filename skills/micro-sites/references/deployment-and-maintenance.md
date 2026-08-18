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
