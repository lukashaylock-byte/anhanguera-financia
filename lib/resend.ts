type InvitationEmail = {
  recipient: string;
  companyName: string;
  inviterName: string;
  role: string;
  url: string;
};

const roleNames: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  FINANCEIRO: 'Financeiro',
  LEITURA: 'Somente leitura',
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export function assertResendConfigured() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error('Configure RESEND_API_KEY e RESEND_FROM_EMAIL para enviar convites.');
  }
}

export async function sendInvitationEmail(invitation: InvitationEmail) {
  assertResendConfigured();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Configuração do Resend indisponível.');

  const companyName = escapeHtml(invitation.companyName);
  const inviterName = escapeHtml(invitation.inviterName);
  const roleName = roleNames[invitation.role] ?? 'Membro';
  const safeRole = escapeHtml(roleName);
  const safeUrl = escapeHtml(invitation.url);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [invitation.recipient],
      subject: `Convite para ${invitation.companyName} no Anhanguera Financia`,
      html: `<main style="font-family:Arial,sans-serif;color:#173128;max-width:560px;margin:32px auto;padding:32px;border:1px solid #e2ebe5;border-radius:16px"><p style="color:#167755;font-weight:700">ANHANGUERA FINANCIA</p><h1 style="font-size:24px">Você foi convidado</h1><p>${inviterName} convidou você para acessar o espaço financeiro de <strong>${companyName}</strong> como <strong>${safeRole}</strong>.</p><p style="margin:28px 0"><a href="${safeUrl}" style="background:#167755;color:white;text-decoration:none;padding:13px 20px;border-radius:8px">Aceitar convite</a></p><p>O link expira em 7 dias. Se você já tem uma conta, entre com seu e-mail para aceitar o convite.</p><p style="color:#73847c;font-size:12px">Se não esperava este convite, ignore esta mensagem.</p></main>`,
      text: `${inviterName} convidou você para acessar ${invitation.companyName} no Anhanguera Financia como ${roleName}. Aceite em: ${invitation.url} (o link expira em 7 dias).`,
    }),
  });
  if (!response.ok) {
    const providerMessage = await response.text();
    console.error('Resend rejeitou o envio do convite:', response.status, providerMessage.slice(0, 500));
    throw new Error('O serviço de e-mail não conseguiu enviar o convite. Verifique a chave, o remetente e o domínio no Resend.');
  }
}
