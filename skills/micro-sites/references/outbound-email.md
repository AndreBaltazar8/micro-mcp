# Verified-user project email

Use project email for a user-requested receipt, confirmation, or status message
after the server has authorized the underlying action. This is a trusted host
capability, not general outbound networking.

```abla
if (request.context.user.authenticated &&
    request.context.user.emailVerified) {
    val queued = microEmailCurrentUser(
        "Your export is ready",
        "Sign in and open Exports to download the finished archive."
    )
}
```

The operation is `email.send_to_current_user`. Subject length is 1–80 UTF-8
bytes; message length is 1–4,000 bytes with printable text, tabs, and line
feeds. Inspect the returned `ok` envelope and handle quota errors explicitly.

Micro derives the enabled, verified recipient from the host-only app session,
encrypts the payload, renders a platform-owned MJML template and plain-text
part, then delivers it through the platform SMTP worker. Wasm cannot choose an
address, sender, reply-to, header, HTML, URL, attachment, DNS name, or provider
credential. Unknown fields are rejected. Do not put passwords, tokens, payment
credentials, or reusable private download URLs in the content.

Production limits are 10 queued messages per app user and 500 per project per
UTC day, reserved atomically across replicas. `micro dev` and remote previews
queue only in-memory fixtures and never send real mail. Use `micro emails
--json` or `micro_emails` to inspect owner-only quota and delivery state; neither
surface returns the encrypted subject or message.

Do not use this for newsletters, arbitrary recipients, scheduled bulk mail, or
an HTTP/webhook substitute. Schedules have no app-user session and therefore
cannot call this operation.
