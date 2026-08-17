# Deployment and maintenance

Before changing a live project:

```sh
micro status --json
micro deployments --json
micro logs --since 30m --json
```

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
