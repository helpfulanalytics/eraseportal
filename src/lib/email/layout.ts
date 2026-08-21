/**
 * The one email template.
 *
 * Every message the product sends renders through `renderEmail`, so the
 * header, the type ramp, the button and the footer are defined once. What
 * differs between an invite and a file notification is *content* — an eyebrow,
 * a headline, a set of facts — never markup.
 *
 * Constraints that explain the shape of the HTML, none of which apply to the
 * app itself:
 *
 * - **Tables, not flex.** Outlook 2016–2021 renders through Word, which has
 *   no flexbox and no `max-width` on a `div`.
 * - **Inline styles.** Several clients strip `<style>`; the `<style>` block
 *   here only carries what inlining can't express (media queries), and every
 *   rule in it is a progressive enhancement over an inline default.
 * - **No inline `<svg>`, no background images.** Gmail drops both.
 * - **A `text` alternative is not optional.** An HTML-only body is one of the
 *   most reliable ways to score as bulk mail, which is why `renderEmail`
 *   returns both parts from the same input rather than letting a call site
 *   forget one.
 */
import { escapeHtml } from "../kitchen-format";
import { COLOR, FONT_STACK, PRODUCT_NAME, POSTAL_ADDRESS, logoUrl } from "./brand";
import type { AccentName } from "./brand";

/** One row of the grey metadata block — the "more context" the old emails had none of. */
export interface EmailFact {
  label: string;
  value: string;
}

export interface EmailContent {
  /** Absolute origin, for the logo and footer links. */
  siteUrl: string;
  /** Category label above the headline: "New file", "Invitation", "Task". */
  eyebrow: string;
  accent: AccentName;
  headline: string;
  /** The inbox preview line. Written, not derived — it's the second thing read after the subject. */
  preheader: string;
  /** Lede paragraphs, plain text; escaped here. */
  intro?: string[];
  /** A verbatim excerpt — a message body, a task title. */
  quote?: { author: string; body: string };
  facts?: EmailFact[];
  cta?: { label: string; href: string };
  /** Small print under the button: expiry, caveats. */
  note?: string;
  /** Why this person is receiving this. Shown in the footer, always. */
  reason: string;
  /** Where to change notification settings, when a workspace is known. */
  settingsUrl?: string;
}

/**
 * Only `http(s)` survives. Every href in this module is internally built, so
 * this guards against a future call site interpolating something user-supplied
 * into a link rather than against anything reachable today.
 */
function safeHref(href: string): string {
  return /^https?:\/\//i.test(href) ? escapeHtml(href) : "#";
}

/**
 * Gmail shows ~100 characters of body after the subject. Without this it
 * shows whatever the first visible text happens to be — on the old templates
 * that was "Hi Brooks," on every single email. The zero-width padding stops
 * it from running on into the header text underneath.
 */
function preheaderBlock(text: string): string {
  const pad = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${COLOR.pageBg};opacity:0;">${escapeHtml(text)}${pad}</div>`;
}

/**
 * The Outlook padding hack: Word ignores padding on an inline `<a>`, so the
 * `<i>` spacers fake it with letter-spacing and everyone else ignores them.
 */
function button(label: string, href: string, accent: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
      <tr>
        <td align="center" bgcolor="${accent}" style="border-radius:8px;">
          <a href="${safeHref(href)}" style="display:inline-block;padding:12px 22px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;mso-padding-alt:0;">
            <!--[if mso]><i style="letter-spacing:22px;mso-font-width:-100%;mso-text-raise:24pt;">&nbsp;</i><![endif]--><span style="mso-text-raise:12pt;">${escapeHtml(label)}</span><!--[if mso]><i style="letter-spacing:22px;mso-font-width:-100%;">&nbsp;</i><![endif]-->
          </a>
        </td>
      </tr>
    </table>`;
}

function factsBlock(facts: EmailFact[]): string {
  const rows = facts
    .map(
      (fact, index) => `
        <tr>
          <td class="ef-muted" style="padding:${index === 0 ? "0" : "8px"} 12px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:19px;color:${COLOR.textMuted};white-space:nowrap;vertical-align:top;">${escapeHtml(fact.label)}</td>
          <td class="ef-text" style="padding:${index === 0 ? "0" : "8px"} 0 0 0;font-family:${FONT_STACK};font-size:13px;line-height:19px;color:${COLOR.text};font-weight:500;word-break:break-word;vertical-align:top;">${escapeHtml(fact.value)}</td>
        </tr>`,
    )
    .join("");

  return `
    <table role="presentation" class="ef-inset" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.insetBg};border:1px solid ${COLOR.hairlineSoft};border-radius:10px;border-collapse:separate;">
      <tr>
        <td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
        </td>
      </tr>
    </table>`;
}

function quoteBlock(quote: { author: string; body: string }, accent: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:0 0 0 14px;border-left:3px solid ${accent};">
          <div class="ef-muted" style="font-family:${FONT_STACK};font-size:13px;line-height:19px;color:${COLOR.textMuted};padding-bottom:4px;">${escapeHtml(quote.author)}</div>
          <div class="ef-text" style="font-family:${FONT_STACK};font-size:15px;line-height:23px;color:${COLOR.text};white-space:pre-wrap;word-break:break-word;">${escapeHtml(quote.body)}</div>
        </td>
      </tr>
    </table>`;
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const accent = COLOR[content.accent];
  const logo = logoUrl(content.siteUrl);

  const intro = (content.intro ?? [])
    .map(
      (paragraph) =>
        `<p class="ef-text" style="margin:0 0 14px 0;font-family:${FONT_STACK};font-size:15px;line-height:23px;color:${COLOR.text};">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const sections: string[] = [];
  if (content.quote) sections.push(quoteBlock(content.quote, accent));
  if (content.facts?.length) sections.push(factsBlock(content.facts));
  // Always blue, never the accent. The accent is a category signal — it tells
  // you at a glance whether this is a file, a task or an invitation — and
  // painting the button with it would make "the thing to click" a different
  // colour in every email. It also produced a muddy olive CTA on the amber
  // task stream. Same rule the app follows: accents are state, blue is action.
  if (content.cta) sections.push(button(content.cta.label, content.cta.href, COLOR.blue));
  if (content.note) {
    sections.push(
      `<p class="ef-muted" style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:19px;color:${COLOR.textMuted};">${escapeHtml(content.note)}</p>`,
    );
  }
  if (content.cta) {
    // A visible fallback URL, because corporate mail gateways rewrite or strip
    // link targets often enough that a button alone can leave a dead end.
    sections.push(
      `<p class="ef-muted" style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:18px;color:${COLOR.textFaint};word-break:break-all;">Button not working? Paste this into your browser:<br /><span style="color:${COLOR.textMuted};">${escapeHtml(content.cta.href)}</span></p>`,
    );
  }

  const body = sections
    .map((section) => `<tr><td style="padding-top:24px;">${section}</td></tr>`)
    .join("");

  const settingsLink = content.settingsUrl
    ? ` &nbsp;·&nbsp; <a href="${safeHref(content.settingsUrl)}" style="color:${COLOR.textMuted};text-decoration:underline;">Notification settings</a>`
    : "";

  const postal = POSTAL_ADDRESS
    ? `<div class="ef-faint" style="padding-top:8px;color:${COLOR.textFaint};">${escapeHtml(POSTAL_ADDRESS)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(content.headline)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  a { color: ${COLOR.blue}; }
  @media (max-width: 600px) {
    .ef-pad { padding-left: 20px !important; padding-right: 20px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .ef-page { background-color: #0e0e0e !important; }
    .ef-card { background-color: #161616 !important; border-color: #2b2b2b !important; }
    .ef-hairline { border-color: #2b2b2b !important; }
    .ef-inset { background-color: #1d1d1d !important; border-color: #2b2b2b !important; }
    .ef-text { color: #f2f2f2 !important; }
    .ef-muted { color: #a6a6a6 !important; }
    .ef-faint { color: #8a8a8a !important; }
    .ef-logo { filter: invert(1) brightness(1.7); }
  }
</style>
</head>
<body class="ef-page" style="margin:0;padding:0;width:100%;background-color:${COLOR.pageBg};-webkit-font-smoothing:antialiased;">
${preheaderBlock(content.preheader)}
<table role="presentation" class="ef-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.pageBg};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" class="ef-card" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background-color:${COLOR.cardBg};border:1px solid ${COLOR.hairline};border-radius:14px;border-collapse:separate;overflow:hidden;">

        <tr>
          <td class="ef-pad ef-hairline" style="padding:20px 32px;border-bottom:1px solid ${COLOR.hairlineSoft};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;">
                  <img class="ef-logo" src="${escapeHtml(logo)}" width="24" height="24" alt="" style="display:block;width:24px;height:24px;border:0;" />
                </td>
                <td class="ef-muted" style="vertical-align:middle;font-family:${FONT_STACK};font-size:14px;font-weight:600;letter-spacing:-0.01em;color:${COLOR.textMuted};">${escapeHtml(PRODUCT_NAME)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="ef-pad" style="padding:28px 32px 32px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <div style="font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${accent};padding-bottom:10px;">${escapeHtml(content.eyebrow)}</div>
                  <h1 class="ef-text" style="margin:0 0 14px 0;font-family:${FONT_STACK};font-size:21px;line-height:28px;font-weight:600;letter-spacing:-0.02em;color:${COLOR.text};">${escapeHtml(content.headline)}</h1>
                  ${intro}
                </td>
              </tr>
              ${body}
            </table>
          </td>
        </tr>

        <tr>
          <td class="ef-pad ef-hairline" style="padding:18px 32px 22px 32px;border-top:1px solid ${COLOR.hairlineSoft};">
            <div class="ef-muted" style="font-family:${FONT_STACK};font-size:12px;line-height:18px;color:${COLOR.textMuted};">${escapeHtml(content.reason)}</div>
            <div class="ef-faint" style="padding-top:8px;font-family:${FONT_STACK};font-size:12px;line-height:18px;color:${COLOR.textFaint};">
              <a href="${safeHref(content.siteUrl)}" style="color:${COLOR.textMuted};text-decoration:underline;">Open ${escapeHtml(PRODUCT_NAME)}</a>${settingsLink}
            </div>
            ${postal}
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { html, text: renderText(content) };
}

/**
 * Built from the same fields rather than by stripping tags out of the HTML —
 * a regex-stripped body reads like debris, and this part is what Apple Watch,
 * screen readers and text-only gateways actually show.
 */
function renderText(content: EmailContent): string {
  const parts: string[] = [content.headline, ""];

  if (content.intro?.length) parts.push(...content.intro, "");
  if (content.quote) {
    parts.push(`${content.quote.author}:`);
    parts.push(
      content.quote.body
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n"),
      "",
    );
  }
  if (content.facts?.length) {
    parts.push(...content.facts.map((fact) => `${fact.label}: ${fact.value}`), "");
  }
  if (content.cta) parts.push(`${content.cta.label}: ${content.cta.href}`, "");
  if (content.note) parts.push(content.note, "");

  parts.push("—", content.reason);
  if (content.settingsUrl) parts.push(`Notification settings: ${content.settingsUrl}`);
  if (POSTAL_ADDRESS) parts.push(POSTAL_ADDRESS);

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
