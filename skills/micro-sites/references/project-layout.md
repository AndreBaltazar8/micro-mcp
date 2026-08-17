# Project layout

Use the conventional tree:

```text
project/
  app.ab
  public/
    index.html
    app.js
    styles.css
  micro.yaml
```

Only `app.ab` or `public/` is required. `micro.yaml` is optional and contains stable public resource definitions, never infrastructure or secrets.

Choose one delivery shape:

- Static shell plus server: serve `public/index.html`; call server or platform routes from browser code.
- Server-rendered: return `text/html` from `app.ab`, preferably using Abla's typed `$html` subparser.
- Static `$html` extraction: use the supported build-time HTML entry when the installed compiler exposes it.
- API-only: omit the index and expose only Wasm routes.

The runner reserves `/_micro/*`. Do not add files or guest routes there. Keep public deployment assets immutable and put any gated object outside `public/`.

Use Abla's strengths directly: typed request classes, forward-only JSON reading at the wire boundary, `$jsons` for frozen JSON literals, `$html` for validated markup, exhaustive control flow, explicit ownership, and a tiny typed wrapper over the single platform import. Keep the low-level allocation/encoding adapter separate from application `handle` logic.

Builds upload a source snapshot plus normalized assets and optional Wasm. Generated `.micro/` state is local tooling output; do not hand-edit it or commit credentials.
