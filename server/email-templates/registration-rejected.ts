/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nodemailer (SMTP) template — Registration Rejected Notification
 *
 * Also compatible with Supabase Auth (replace dynamic parts with Handlebars).
 */
export function registrationRejectedTemplate(params: {
  userName: string;
  appName: string;
  rejectionReason: string;
}): { subject: string; html: string } {
  const { userName, appName, rejectionReason } = params;
  return {
    subject: `Cadastro atualizado — ${appName}`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cadastro atualizado — ${appName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0a0f0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; background-color: #131a15; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; color: #fca5a5; font-size: 13px; }
    .icon { font-size: 32px; margin-bottom: 8px; }
    .body { padding: 28px 24px; }
    .body p { margin: 0 0 12px; color: #e4e4e7; font-size: 15px; line-height: 1.6; }
    .body .reason { background-color: #0a0f0d; border: 1px solid #dc262633; border-radius: 12px; padding: 12px 16px; margin: 12px 0; font-size: 13px; color: #fca5a5; }
    .body .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #27272a44; }
    .body .info-row:last-child { border-bottom: none; }
    .body .info-label { color: #71717a; font-size: 12px; }
    .body .info-value { color: #e4e4e7; font-size: 12px; font-weight: 600; }
    .btn { display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; letter-spacing: -0.01em; }
    .body .mt-16 { margin-top: 16px; }
    .footer { border-top: 1px solid #27272a; padding: 16px 24px; text-align: center; }
    .footer p { margin: 0; color: #52525b; font-size: 11px; }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f0d;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <div class="container">
          <div class="header">
            <div class="icon">&#10060;</div>
            <h1>Cadastro Atualizado</h1>
            <p>Para o grupo <strong>${appName}</strong></p>
          </div>
          <div class="body">
            <p>Olá, <strong>${userName}</strong>,</p>
            <p>Sua solicitação de cadastro no <strong>${appName}</strong> foi revisada e a decisão final é a seguinte:</p>
            <div class="reason">
              <strong>Motivo:</strong> ${rejectionReason}
            </div>
            <p class="mt-16">Caso tenha dúvidas sobre a decisão ou queira enviar uma nova solicitação, entre em contato com um administrador do grupo.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <a href="" target="_blank" class="btn">Voltar ao login</a>
                </td>
              </tr>
            </table>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${appName}. Todos os direitos reservados.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}
