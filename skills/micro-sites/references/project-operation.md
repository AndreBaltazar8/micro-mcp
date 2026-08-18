# Project operation

Inspect the linked project and caller authority before changing access:

```sh
micro settings --json
micro members --json
micro invitations --json
```

The owner has full project authority. A viewer may inspect shared project state,
a developer may deploy, and an admin may manage project access. Deployment
promotion is a separate `can_promote` grant; viewers can never promote. Shared
project access never grants account billing access or ownership of app users,
records, purchases, or unrelated projects.

Change visibility only after checking the intended audience and live behavior:

```sh
micro settings visibility private --confirm --json
```

A private site requires an authenticated app user or a live, unexpired private
access grant. Creating a grant returns its bearer token once. Because that token
must not enter model context, MCP arguments, shell history, logs, or committed
files, pause for a secure interactive CLI handoff:

```sh
micro private-grants create --expires-days 30 --label client-review --json
micro private-grants --json
micro private-grants revoke GRANT_ID --confirm --json
```

Use direct membership only for an existing known Micro account:

```sh
micro members set teammate@example.com developer --can-promote --json
micro members remove ACCOUNT_ID --confirm --json
```

For a person who has not joined the project, send a single-use invitation:

```sh
micro invitations create teammate@example.com developer --can-promote --json
micro invitations revoke INVITATION_ID --confirm --json
micro invitations accept --token-stdin --json
```

Invitation acceptance always uses stdin in a secure user-controlled handoff.
Never ask the user to paste the token into chat or pass it to an MCP tool.

Custom domains require exact DNS ownership proof before activation:

```sh
micro domains add shop.example.com --json
micro domains --json
micro domains verify DOMAIN_ID --json
micro domains remove DOMAIN_ID --confirm --json
```

Publish the returned DNS record, wait for authoritative resolution, then verify
the exact inspected domain ID. After verification, check public DNS, TLS, the
homepage, assets, Wasm routes, and platform SDK routes on that hostname. A
successful API response alone is not proof that the edge has converged.

Inspect plan and cost state before commercial or capacity changes:

```sh
micro plans --json
micro usage --json
micro billing --json
```

Spending caps belong to the authenticated account, not one project. Hard stop is
the default and can reject new runner work when the cap is exhausted; `--soft`
only warns:

```sh
micro spending-cap set --monthly-cents 2500 --warning-percent 75 --json
micro spending-cap set --monthly-cents 2500 --warning-percent 75 --soft --json
micro spending-cap delete --confirm --json
```

Explain the current usage, threshold, hard-versus-soft behavior, and affected
projects before replacing or removing the policy. Billing remains fail closed
when the platform has not enabled paid plans. When it is enabled, inspect the
public plan first and use hosted Stripe surfaces only:

```sh
micro billing checkout pro --json
micro billing portal --json
```

Never accept card data, Stripe credentials, webhook secrets, or provider IDs in
site code, MCP arguments, or CLI arguments. Verify subscription state through
`micro billing`; do not infer it merely from returning from checkout.
