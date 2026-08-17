# Digital-product workflow

Use this as the standing complete-product test.

1. Lock the audience, product promise, page hierarchy, visual direction, price, entitlement, and protected file.
2. Start from the reviewed digital-product example. Implement static and authenticated SSR pages, app signup/sign-in, server-side entitlement display, checkout, purchase history, and download states.
3. Run format, build, automated tests, local runner tests, and browser checks. Use test fixtures only.
4. Create an opaque remote preview. Confirm it did not create a project or reserve the intended slug.
5. Complete secure owner signup and email verification outside model-visible inputs.
6. Deploy production and confirm atomic project creation, slug claim, source/Wasm/asset digests, TLS, and live routing.
7. Connect the owner's Stripe account, synchronize the stable product without deleting remote resources, and upload the protected file with checksum verification.
8. Create a new app user, verify email, start checkout, complete a Stripe test payment, process the signed webhook, and confirm authoritative purchase plus entitlement state.
9. Confirm the Wasm server can read the buyer's entitlement and receives an idempotent `purchase.completed` event.
10. Download the protected file, then revoke/refund and confirm a new transfer is denied.
11. Deploy a second code revision from the linked GitHub Action using OIDC. Verify live output and deployment reporting.
12. Roll back code and confirm the app user, purchase, entitlement history, and protected object remain intact.

Do not call the workflow complete when payment or download is mocked, when only the success redirect was observed, or when a production-only step has not run. State the exact remaining credential or external event.
