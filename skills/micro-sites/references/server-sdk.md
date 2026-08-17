# Abla server SDK

Export the conventional Micro adapter and implement:

```abla
fun handle(request: MicroRequest): MicroResponse
```

The trusted request contains method, path, query, selected headers, decoded body, and:

```text
request.context.projectId
request.context.environment
request.context.user.authenticated
request.context.user.id
request.context.user.email
request.context.user.displayName
request.context.user.emailVerified
```

The runner derives this context. Never accept project IDs, environment, or user IDs from request JSON as authority.

Use the typed server helpers from the reviewed Abla example. They call the sole allowed import, `env::micro_platform_call(i64, i64, i64, i64) -> i64`, with bounded JSON. Unknown imports, WASI, filesystem, environment, sockets, and subprocesses are rejected.

Data operations are `data.get`, `data.list`, `data.put`, and `data.delete`. Select `scope: "user"` for the authenticated user or `scope: "project"` for shared records. Check operation envelopes before using their records. Use optimistic versions for concurrent writes.

Render private HTML only after checking `request.context.user`. Recheck entitlement or record policy through the platform API for every privileged action; hiding a link is not authorization.

Application events such as `purchase.completed` are internal authenticated invocations with stable event IDs and at-least-once delivery. Make handlers idempotent and keep the platform purchase ledger authoritative.
