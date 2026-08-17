# Products and protected files

Use `micro.yaml` only when stable resource definitions should travel with source:

```yaml
slug: preset-shop
products:
  - id: preset-pack
    name: Lightroom Preset Pack
    price: 1900
    currency: EUR
    type: one_time
    entitlement: preset-files
files:
  - id: preset-files
    source: ./private/preset-pack.zip
    access:
      entitlement: preset-files
```

Treat resource synchronization as create-or-update. Omission never deletes, archives, disconnects, or revokes. Price and currency changes may create a new provider price and require explicit review.

Reference the stable Micro product ID in site source. Never use Stripe price IDs. Connect Stripe through the owner dashboard or secure CLI handoff; never put provider credentials in source, YAML, environment visible to the harness, or MCP arguments.

Keep protected files outside `public/`. Upload through the owner CLI/dashboard, record checksums, and verify the resulting stable object ID. Use `Micro.download(fileId)`; never construct backend paths or signed object-store URLs.
