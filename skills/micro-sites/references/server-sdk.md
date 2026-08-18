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

Render private HTML only after checking `request.context.user`. Use Abla's
`$html` tree and the reviewed example's `microHtmlResponse` helper so literal
and interpolated text is escaped before the runner injects the browser SDK:

```abla
fun libraryPage(request: MicroRequest): Html {
    val user = request.context.user
    if (user.authenticated)
        return $html <main><h1>Welcome, {user.email}.</h1></main>
    $html <main><h1>Sign in to continue.</h1></main>
}

if (request.method == "GET" && request.path == "/library")
    return microHtmlResponse(200, libraryPage(request))
```

Copy the current renderer and response helper from
[`digital-product/micro.ab`](https://github.com/microdotdo/micro-examples/blob/main/digital-product/micro.ab),
and keep application routing in
[`digital-product/handler.ab`](https://github.com/microdotdo/micro-examples/blob/main/digital-product/handler.ab).
Do not interpolate authenticated values into raw HTML strings. Recheck
entitlement or record policy through the platform API for every privileged
action; hiding a link is not authorization.

For a user-requested receipt or confirmation, call
`email.send_to_current_user` through the reviewed `microEmailCurrentUser`
helper only after checking `authenticated`, `emailVerified`, and the underlying
record or entitlement. Micro derives the recipient and accepts only an 80-byte
subject plus a 4,000-byte plain-text message. Read `outbound-email.md`; never
invent recipient, sender, HTML, URL, attachment, or provider arguments.

Application events such as `purchase.completed` and `schedule.triggered` are
internal authenticated invocations with stable `x-micro-event-id` values and
at-least-once delivery. Public requests never reach these runner-owned paths.
Make handlers idempotent and keep platform ledgers authoritative. Read
`schedules.md` before implementing recurring work.
