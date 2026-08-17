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

Use the first-party Action with `contents: read` and `id-token: write`. Pin it to a full commit SHA in production. Do not create a permanent deploy secret; the Action exchanges GitHub OIDC for a short-lived, binding-scoped operation token.
