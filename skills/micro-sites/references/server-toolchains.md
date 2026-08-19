# Server toolchains

Choose the smallest toolchain that completes the requested journey:

- Use no server compiler for public static pages and browser SDK flows that do
  not need a trusted custom policy or server-rendered response.
- Use Abla for compact platform-aware handlers, typed `$html` SSR, schedules,
  purchase events, or an existing Abla project. Read `server-sdk.md` after
  selecting it.
- Use Rust for an existing Rust codebase, Rust-specific libraries that work
  without WASI, or when the team explicitly prefers Rust. Start from the
  reviewed `hello-rust` and `crates/micro-guest` sources in
  `microdotdo/micro-examples`; do not improvise the wire adapter.
- Preserve another existing language only when its build emits the exact ABI
  below without WASI or extra imports. Otherwise choose a reviewed path.

Do not choose based on benchmark folklore or because one option is presented
first. Record why the selected path fits the site's actual behavior and owner
maintenance needs.

## Build handoff

`micro build` consumes a server at `.micro/build/app.wasm`. It compiles
root-level `app.ab` automatically when Abla is selected. For Rust or another
toolchain, run that build first and copy its final module to that exact path;
then let `micro build` validate and bundle it. Generated `.micro/` files are
local output, not credentials or hand-edited source.

Static projects require only `public/index.html`. The optional runner is needed
for `micro dev`, not for building static assets or deploying a prebuilt bundle.
Use `micro doctor --json` to inspect what the current project requires.

## Language-neutral ABI

The module must export linear `memory` and either the canonical 32-bit pair:

```text
micro_alloc(i32) -> i32
micro_handle(i32, i32) -> i64
```

or the corresponding 64-bit scalar form. Request and response envelopes are
bounded JSON in linear memory. The packed response stores a 32-bit pointer in
the high half and a 32-bit length in the low half.

The only permitted import is the optional bounded platform capability:

```text
env::micro_platform_call(i64, i64, i64, i64) -> i64
```

WASI, filesystem, environment, clock, random, DNS, sockets, subprocesses, and
all other imports are rejected. The runner derives the project, environment,
and authenticated app-user scope. Keep the ABI adapter tiny and reviewed; keep
business logic in ordinary typed functions.
