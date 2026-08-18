# Schedules

Use schedules for bounded recurring work such as digests, cleanup, aggregation,
or sync attempts. They are interval-based and deliver only to the active
production Wasm deployment.

Inspect before changing state:

```sh
micro schedules --json
```

Create or replace one stable schedule. Put its non-secret object payload in a
file so it does not enter shell history:

```sh
micro schedules set daily-digest --every-minutes 1440 --payload-file schedule.json --json
micro schedules set cleanup --every-minutes 60 --disabled --json
```

Intervals are 5 through 10,080 minutes. Payloads are JSON objects up to 8 KiB
and are ordinary application configuration, never credential storage. Updating
an interval or enabled state moves the next run forward by that interval.

Handle the trusted internal request in Abla:

```abla
if (request.method == "POST" &&
    request.path == "/_micro/events/schedule.triggered") {
    val event = jsonParse(request.body)
    // Validate schedule, scheduled_at, manual, and payload before use.
    // Store x-micro-event-id with the side effect and return success on repeats.
}
```

The body is `{ schedule, scheduled_at, manual, payload }`. Delivery is at least
once and includes `x-micro-event-id` plus `x-micro-event-attempt`. Return a 2xx
response only after the effect is durable. Automatic delivery does not overlap
unfinished work for the same schedule, and recovery skips old backlog rather
than flooding the project; neither guarantee replaces handler idempotency.

Manually enqueue or remove only after inspecting the exact ID:

```sh
micro schedules run daily-digest --confirm --json
micro schedules remove daily-digest --confirm --json
```

A manual run creates a separate event even when an automatic delivery is
pending. Removing a schedule cancels pending or retryable deliveries but cannot
recall a delivery already executing. Do not use schedules for exact-time jobs,
unbounded fan-out, secrets, or public callbacks.
