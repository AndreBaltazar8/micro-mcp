# Project layout

Start with only the pieces the site needs:

```text
project/
  public/
    index.html
    app.js
    styles.css
  app.ab                  # optional Abla server
  rust/                   # optional Rust server source instead
  .micro/build/app.wasm   # selected server build output
  micro.yaml              # optional products
```

Only `public/`, `app.ab`, or a compatible `.micro/build/app.wasm` is required.
Do not create all three server forms. `micro.yaml` contains stable public
resource definitions, never infrastructure or secrets.

Choose one delivery shape:

- Static shell plus server: serve `public/index.html`; call server or platform routes from browser code.
- Server-rendered with Abla: build an Abla `$html` tree and return it through the reviewed
  `microHtmlResponse` helper; read `server-sdk.md` for the exact escaping and
  authenticated-context pattern.
- Custom server build: compile Rust or another language to
  `.micro/build/app.wasm`; read `server-toolchains.md` for selection and ABI
  rules.
- Static `$html` extraction: use the supported build-time HTML entry when the installed compiler exposes it.
- API-only: omit the index and expose only Wasm routes.

The runner reserves `/_micro/*`. Do not add files or guest routes there. Keep public deployment assets immutable and put any gated object outside `public/`.

When selecting Abla, use its strengths directly: typed request classes,
forward-only JSON reading at the wire boundary, `$jsons` for frozen JSON
literals, `$html` for validated markup, exhaustive control flow, explicit
ownership, and a tiny typed wrapper over the single platform import. With any
language, keep the low-level allocation/encoding adapter separate from
application handler logic.

Builds upload a source snapshot plus normalized assets and optional Wasm. Generated `.micro/` state is local tooling output; do not hand-edit it or commit credentials.
