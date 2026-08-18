# Browser SDK

Every HTML response receives the same-origin SDK. Use the global `Micro`; do not bundle provider SDKs or reproduce runner routes.

Core calls:

```js
await Micro.currentUser()
await Micro.signUp(email, password)
await Micro.signIn(email, password)
await Micro.signOut()
await Micro.verifyEmail(token)
Micro.auth.loginWithMicro({ returnTo: "/library" })
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

Use `Micro.auth.loginWithMicro()` when a site should accept an existing verified
Micro account. It navigates through the runner-owned start route, the
`micro.do` consent screen, and a fixed runner callback. The control plane sends
only verified email and display name; the runner links or creates a
project-local app user and issues the ordinary host-only app cookie. The site
never receives the global access/refresh cookies, password, projects, billing,
or dashboard permission. `returnTo` must be a same-site relative path; do not
build an OAuth client, callback handler, authorization URL, or cookie logic in
site assets or Wasm.

For an explicit entry point:

```js
document.querySelector("#login-with-micro").addEventListener("click", () => {
  Micro.auth.loginWithMicro({ returnTo: "/account" })
})
```

`Micro.auth.open()` also includes Login with Micro alongside project-local
email/password authentication. Keep a local sign-in option when the product
requires accounts independent of a global Micro account.

Do not read or set Micro cookies. A project `__Host-micro_app` cookie is not and
cannot become a `micro.do` owner session. Do not trust return URLs as proof of
identity or payment; refresh identity with `Micro.currentUser()` and render
purchase state only from `Micro.purchases()` or a server-side entitlement
check.
