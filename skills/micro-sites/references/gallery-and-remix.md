# Curated gallery and remix

Use `micro_gallery` to list reviewed, explicitly licensed immutable source
snapshots. Choose one entry because its audience and product journey are close
to the requested site, not merely because its visual style is attractive. Read
the creator, license, source deployment, bundle digest, source digest, consent
record, terms version, and `micro.gallery-copy.v1` policy before materializing
it.

Use `micro_remix` with a fresh local directory. The operation requires no owner
login and must report both `project_created: false` and `slug_reserved: false`.
It verifies each restored file and records the immutable source provenance in
`.micro/remix.json`. Preserve that file while adapting the starter so future
maintainers can identify the source and license.

Remix materializes Abla source, public assets, and stable product definitions
from `micro.yaml`. It removes the source project's `slug:` convenience field.
It does not materialize compiled Wasm or remote resource state, and it never
copies project identity, app users, records, purchases, entitlements, protected
files, domains, members, provider connections, secrets, schedules, or email
history.

After remixing, treat the directory as new untrusted input: inspect it, adjust
the audience and journey, run its tests, build it from source, run `micro dev`,
and review it in a real browser. Choose a new slug only at production deploy.
Do not use `micro pull` for remix; pull is an authenticated continuation of a
project the owner already controls and writes linked project state.
