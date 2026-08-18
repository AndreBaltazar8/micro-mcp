# Security and quality gate

Check these boundaries:

- Owner identity belongs only to the control-plane host; app identity belongs only to the resolved project host.
- Login with Micro consumes a one-time, project-bound exchange into a new app
  session. It never copies owner tokens or grants dashboard authority to the
  project cookie.
- Every mutation enforces exact same-origin or an equivalent CSRF proof.
- The runner, not browser or Wasm input, derives project, environment, app user, product, purchase, and object scope.
- Wasm has one allowlisted platform import plus fuel, wall-time, memory, response, host-call, database-operation, and concurrency limits.
- Browser SDK calls remain hostile inputs and receive full authorization checks.
- Preview users, records, products, purchases, and files are isolated fixtures; production state never enters a harness.
- Payment webhooks are signature-verified and deduplicated; redirects never grant entitlement.
- Protected downloads recheck current entitlement at transfer time.
- Logs and reports omit cookies, passwords, request credentials, provider data, and raw payment details.

Run hostile checks appropriate to the feature: unknown Wasm import, oversized request/record/file, traversal path, tenant escape, second-user access, stale record version, cross-origin mutation, replayed payment event, revoked entitlement, and concurrent slug claim.

Review the result in a real browser at desktop and narrow mobile widths. Check keyboard focus, form labels, error recovery, loading states, content wrapping, and network failures. Report what actually ran, the observed result, and any production-only step still waiting for credentials.
