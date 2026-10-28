/**
 * Transactional email through Resend (raw fetch, like the invite email).
 * Never throws: returns { ok, error } so callers can record what happened.
 */

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

const FROM = () => process.env.ALERTS_FROM || process.env.INVITE_FROM || process.env.CONTACT_FROM || "Advertix <onboarding@resend.dev>";

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A plain branded email: heading, body HTML, optional button, footer with a settings link. */
export function emailLayout(opts: { heading: string; body: string; cta?: { label: string; url: string }; footer?: string }) {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#14121f">
  <h2 style="margin:0 0 12px;font-size:19px">${escapeHtml(opts.heading)}</h2>
  <div style="line-height:1.55;color:#4a4760;font-size:14px">${opts.body}</div>
  ${opts.cta ? `<p style="margin:22px 0 0"><a href="${opts.cta.url}" style="background:#6448f2;color:#fff;text-decoration:none;padding:11px 16px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(opts.cta.label)}</a></p>` : ""}
  ${opts.footer ? `<p style="margin:24px 0 0;font-size:12px;color:#8a879b">${opts.footer}</p>` : ""}
</div>`;
}

export type EmailExtras = {
  /** Shown as "<name> via Advertix" on our verified address (client reports, C4b). */
  fromName?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
};

export async function sendEmail(to: string | string[], subject: string, html: string, extras: EmailExtras = {}): Promise<{ ok: boolean; error: string | null }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Email isn't set up on the server (RESEND_API_KEY)." };
  const address = /<([^>]+)>/.exec(FROM())?.[1] ?? FROM();
  const name = extras.fromName?.replace(/[<>"\r\n]/g, "").trim().slice(0, 60);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: name ? `${name} via Advertix <${address}>` : FROM(),
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(extras.replyTo ? { reply_to: extras.replyTo } : {}),
        ...(extras.attachments?.length ? { attachments: extras.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) } : {}),
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email failed" };
  }
}
