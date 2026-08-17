# Browser SDK

Every HTML response receives the same-origin SDK. Use the global `Micro`; do not bundle provider SDKs or reproduce runner routes.

Core calls:

```js
await Micro.currentUser()
await Micro.signUp(email, password)
await Micro.signIn(email, password)
await Micro.signOut()
await Micro.verifyEmail(token)
await Micro.invoke("/api/render", { theme: "warm" })

await Micro.data.get("notes", "welcome")
await Micro.data.list("notes", { limit: 25, after: "cursor" })
await Micro.data.put("notes", "welcome", { body: "Hello" }, { expectedVersion: 1 })
await Micro.data.remove("notes", "welcome", { expectedVersion: 2 })

await Micro.purchase("preset-pack", { quantity: 1 })
await Micro.purchases()
await Micro.download("preset-files")
```

Expect normalized JSON errors and handle pending, unauthenticated, conflict, cancelled-checkout, and denied-download states. `expectedVersion: 0` means create only; a positive value provides optimistic concurrency.

Browser data is always scoped to the current app user. Shared project records belong behind a Wasm route and a server-side policy check.

Do not read or set Micro cookies. Do not trust return URLs as proof of payment. Render purchase state only from `Micro.purchases()` or a server-side entitlement check.
