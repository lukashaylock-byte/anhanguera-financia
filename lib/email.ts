type AppEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function getPublicAppUrl(requestUrl: string) {
  const configuredUrl = process.env.APP_URL;
  const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const publicUrl = configuredUrl ||
    (deploymentHost ? `https://${deploymentHost}` : process.env.NODE_ENV === 'production'
      ? 'https://anhanguera-financia.vercel.app'
      : requestUrl);
  const url = new URL(publicUrl);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:')) {
    throw new Error('APP_URL deve usar HTTPS em produção.');
  }
  return url.origin;
}

export function isEmailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export async function sendAppEmail(email: AppEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Configure RESEND_API_KEY e RESEND_FROM_EMAIL para enviar e-mails.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`O Resend recusou o envio do e-mail (HTTP ${response.status}).`);
}
