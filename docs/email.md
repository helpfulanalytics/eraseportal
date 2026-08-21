# Email

Everything the portal sends, how it's addressed, and the DNS that decides
whether any of it arrives.

Code lives in [`src/lib/email/`](../src/lib/email):

| File | Job |
| --- | --- |
| `brand.ts` | Colours, product name, logo URL, reply address. Literals, because email can't read CSS custom properties. |
| `streams.ts` | The four sender identities, and the `From` header they produce. |
| `layout.ts` | The single template. Returns `{ html, text }` — both, always. |
| `templates.ts` | One `build*`/`send*` pair per event. `build*` is pure. |
| `preview.ts` | Fixtures and the gallery. Dev only. |

## Seeing the emails

```bash
npm run dev      # then open http://localhost:3000/api/email/preview
npm run email:preview   # or write the same page to email-preview.html
```

Every template renders from the same `build*` function production calls, with
no Resend key and nothing sent. The gallery shows the `From`, subject and
preheader above each one — the three things a recipient actually decides on —
plus the `text/plain` alternative. Switch your OS theme to check dark mode;
the frames carry their own `prefers-color-scheme` rules.

`/api/email/preview` 404s when `NODE_ENV=production`.

## The four streams

Everything used to go out as `invites@erasefriction.com`, so a file-upload
notification arrived from a sender called "invites". Now:

| Stream | Address | `From` display | Used by |
| --- | --- | --- | --- |
| `invites` | `invites@erasefriction.com` | *inviter* via Erase Friction | Client + member invites, invite accepted |
| `files` | `files@erasefriction.com` | *uploader* via Erase Friction | File added to a folder |
| `messages` | `messages@erasefriction.com` | *author* via Erase Friction | New message in a conversation |
| `tasks` | `tasks@erasefriction.com` | *actor* via Erase Friction | Task assigned, task completed |

Two rules behind that table, both load-bearing:

**All four are local-parts on one domain.** Reputation at Gmail and Outlook
accrues to the domain and the DKIM `d=`, not to the local-part. Splitting
streams across addresses costs nothing and gives recipients something to
filter on; splitting them across *domains* or unwarmed subdomains would hand
each one a cold reputation, which is the single most common way a legitimate
product's mail starts landing in spam. Don't add `notify.erasefriction.com`
without reading the warm-up note at the bottom.

**The actor's name fronts the display name.** "Brooks Conkle via Erase
Friction" — the subject line already says *what* happened, so the sender
column is free to say *who*. `via` is the convention Gmail itself uses when a
domain sends on another's behalf; claiming to *be* Brooks would be spoofing.

Give each address a real mailbox or an alias forwarding to a monitored inbox.
`Reply-To` is set to `hello@erasefriction.com` on every send, but some clients
and most autoresponders reply to `From` anyway, and a hard-bouncing sender
address is a negative signal.

## DNS

### 1. Authenticate the domain (required)

In Resend → Domains → add `erasefriction.com`. It generates three records:

- **MX** on a bounce subdomain (`send.erasefriction.com` → an Amazon SES
  feedback host). This is the Return-Path; without it bounces have nowhere to
  go and Resend can't suppress dead addresses.
- **TXT SPF** on the same subdomain, `v=spf1 include:amazonses.com ~all`.
- **TXT DKIM** at `resend._domainkey.erasefriction.com`.

Copy them exactly as the dashboard shows them — the DKIM key and the SES
region are account-specific, so the values below are shapes, not values to
paste. Wait for all three to read "Verified" before sending anything.

If `erasefriction.com` already sends mail through Google Workspace, **do not
replace the existing SPF record.** A domain may have exactly one `v=spf1`
record; two is a permanent error that fails SPF for *all* your mail, Workspace
included. Resend's SPF goes on the `send.` subdomain precisely to avoid this.

### 2. DMARC (required before BIMI, worth it regardless)

```
_dmarc.erasefriction.com  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@erasefriction.com; adkim=r; aspf=r"
```

Start at `p=none`. It changes nothing about delivery; it just asks receivers to
report. Read the aggregate reports for a couple of weeks — a free tool like
Postmark's DMARC Digests or dmarcian will parse them — and confirm nothing
legitimate is failing alignment. Then tighten:

```
p=none  →  p=quarantine; pct=100  →  p=reject
```

Gmail and Yahoo have required a DMARC record of *some* kind from bulk senders
since February 2024. `p=none` satisfies that. `p=quarantine` or stricter is
what BIMI needs, and it's also what stops anyone spoofing your domain at your
own clients — worth doing on its own merits.

### 3. BIMI — the logo in the avatar circle

This is the part that replaces Gmail's grey "I" circle with the mark.

```
default._bimi.erasefriction.com  TXT  "v=BIMI1; l=https://erasefriction.com/bimi-logo.svg; a=https://erasefriction.com/vmc.pem"
```

[`public/bimi-logo.svg`](../public/bimi-logo.svg) is already in the repo and
already conforms: SVG Tiny 1.2 Portable/Secure, square viewBox, a `<title>`,
no scripts, links, external references, filters or animation. BIMI rejects the
app's own `icon.svg` on every one of those counts, which is why it's a
separate file.

**Be clear-eyed about the `a=` parameter.** Gmail, Yahoo and Apple Mail all
refuse to display a BIMI logo without a certificate:

- **VMC** (Verified Mark Certificate) — needs a *registered* trademark on the
  mark. Issued by DigiCert or Entrust, roughly $1,000–1,500/year.
- **CMC** (Common Mark Certificate) — for marks in continuous use for 12+
  months without a registration. Cheaper, and Gmail has accepted them since
  2024. This is the realistic route unless the four-tile mark is registered.

Without a certificate the record is still valid and Fastmail and Zoho will
show the logo, but **Gmail will not** — which is the inbox in the screenshot.
Publish the record now if you like; it costs nothing and starts working the
day a certificate exists. Just don't expect the grey circle to change before
then.

**Two free things that do work in the meantime:**

1. If `erasefriction.com` is on Google Workspace, create each stream address as
   a user or alias and set a profile photo on it. Gmail sources sender avatars
   from Google profile data keyed to the address, and mail sent through Resend
   still carries that address — so Gmail-to-Gmail recipients often see the
   photo. Not guaranteed and not documented by Google, but it's ten minutes.
2. Anyone who saves the address to their contacts with a photo sees that photo.
   Worth mentioning to the handful of clients who matter most.

The mark also renders *inside* every email regardless of any of this — that
part is done, and needs no DNS.

## What the code already does

Handled in `resend.ts` and `layout.ts`, so no call site can forget:

- **A `text/plain` alternative on every message.** HTML-only bodies are one of
  the most reliable ways to score as bulk. Built from the same structured
  content as the HTML, not regex-stripped out of it.
- **`Reply-To` a monitored human inbox.** Replies are a strong positive
  engagement signal, and a notification that bounces on reply reads as
  machinery.
- **`List-Id` per stream**, so recipients can filter one kind of mail without
  muting everything.
- **`Auto-Submitted: auto-generated` and `X-Auto-Response-Suppress`**, which
  stop Exchange out-of-office replies bouncing back at — and occasionally
  looping against — the notification addresses.
- **Threading that matches the product.** Messages in one conversation, and
  uploads into one folder, share a `References` header and collapse into a
  single Gmail thread. Everything else gets a unique `X-Entity-Ref-ID` so
  Gmail *doesn't* collapse unrelated notifications with similar subjects.
- **A written preheader** on every template. Without one Gmail shows whatever
  the first body text is — which on the old templates was "Hi Brooks," on
  every single email.
- **One small image, lots of text.** A high text-to-image ratio and no
  background images, no image-only layouts, no link shorteners.
- **One recipient per send.** Fan-outs loop; nothing is ever BCC'd.
- **Resend tags** (`stream`, `type`), so per-template delivery and bounce
  rates are visible in the dashboard rather than inferred.

## Still open

- **`List-Unsubscribe` is off by default.** Set `EMAIL_UNSUBSCRIBE_URL` and the
  three activity streams start advertising it. Deliberately not on yet: the
  header is only sent when there's a page behind it that can actually perform
  the unsubscribe, and `/w/[orgSlug]/settings` has no notification toggles.
  A header advertising a dead unsubscribe counts *against* the sender at Gmail,
  so this stays off until the preferences UI exists. When it does, add
  per-stream opt-outs there and consider a one-click POST endpoint
  (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`), which Gmail and Yahoo
  now expect from bulk senders.
- **Leave Resend's click tracking off** for these. It rewrites every link
  through a tracking domain, which weakens the domain alignment story and makes
  the "paste this into your browser" fallback URL point somewhere that isn't
  the portal.
- **Warm up a new domain, not a new address.** Adding `tasks@` to an already-
  verified `erasefriction.com` needs no ramp. Moving to a *new* domain or
  subdomain does: a few hundred a day for the first week, doubling weekly.

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | — | Required to send. Absent is fine everywhere that doesn't. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Origin for every link in every email. **Must be the real origin in production** or invite links point at localhost. |
| `EMAIL_SENDING_DOMAIN` | `erasefriction.com` | The one authenticated domain all four streams sit on. |
| `EMAIL_REPLY_TO` | `hello@<domain>` | Monitored inbox. |
| `EMAIL_LOGO_URL` | `<site>/api/email/logo` | Override once a real logo file exists. |
| `EMAIL_UNSUBSCRIBE_URL` | unset | See above. |
| `EMAIL_POSTAL_ADDRESS` | unset | Rendered in the footer when set. |

`RESEND_FROM_ADDRESS` is no longer read — `streams.ts` composes the `From`
header from `EMAIL_SENDING_DOMAIN` instead. It can be deleted from `.env.local`.
