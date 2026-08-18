# CLI workflow

Check compatibility first:

```sh
micro --version
micro account status --json
```

Create and build locally:

```sh
micro new preset-shop
cd preset-shop
micro build --json
micro dev
```

Preview without claiming a slug:

```sh
micro deploy --preview --json
```

Authenticate through secure input:

```sh
micro signup --email owner@example.com
micro signup --email owner@example.com --password-stdin --json
micro account status --wait --json
```

Use `--password-stdin` only when the harness has a secret channel that does not place the password in model context or logs. Otherwise pause for interactive terminal/browser completion.

Deploy after preview review:

```sh
micro deploy preset-shop --json
```

The first successful production deployment atomically creates the project and claims the slug. A local scaffold, failed upload, or remote preview reserves nothing. Preserve `.micro/project.json`; it links later deployments to the project ID and base revision without containing credentials.

After linking, use [project-operation.md](project-operation.md) for team access,
private visibility, custom domains, usage caps, and billing. These operations
derive the project from `.micro/project.json`; do not accept a caller-supplied
project ID as a substitute.

Never pass a password as a command argument or environment variable. Do not print the credentials file; verify its mode is `0600` when diagnosing storage.
