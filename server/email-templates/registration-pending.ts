/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nodemailer (SMTP) template — Registration Pending Notification
 *
 * Sent to a user after they register, confirming receipt of their request.
 *
 * For Supabase Auth import, replace dynamic parts with Handlebars:
 *   - appName → {{ .SiteName }}
 *   - userName → {{ .User.name }}
 */
export function registrationPendingTemplate(params: {
  userName: string;
  appName: string;
  estimatedWaitDays?: number;
}): { subject: string; html: string } {
  const { userName, appName, estimatedWaitDays = 2 } = params;
  return {
    subject: `Cadastro recebido — ${appName}`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cadastro recebido — ${appName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0a0f0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; background-color: #131a15; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%); padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; color: #bae6fd; font-size: 13px; }
    .icon { font-size: 32px; margin-bottom: 4px; }
    .body { padding: 28px 24px; }
    .body p { margin: 0 0 12px; color: #e4e4e7; font-size: 15px; line-height: 1.6; }
    .body .info { background-color: #0a0f0d; border: 1px solid #27272a; border-radius: 12px; padding: 14px 16px; margin: 16px 0; }
    .body .info-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .body .info-label { color: #71717a; font-size: 12px; }
    .body .info-value { color: #e4e4e7; font-size: 12px; font-weight: 600; }
    .body .note { color: #71717a; font-size: 12px; line-height: 1.5; margin-top: 16px; border-top: 1px solid #27272a; padding-top: 12px; }
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
            <div class="icon">&#128203;</div>
            <h1>Cadastro Recebido</h1>
            <p>Para o grupo <strong>${appName}</strong></p>
          </div>
          <div class="body">
            <p>Olá, <strong>${userName}</strong>,</p>
            <p>Recebemos a sua solicitação de cadastro no <strong>${appName}</strong> com sucesso!</p>
            <div class="info">
              <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:#38bdf8;">Aguardando aprovação</span></div>
              <div class="info-row"><span class="info-label">Tempo estimado</span><span class="info-value">~${estimatedWaitDays} dia(s)</span></div>
            </div>
            <p class="note">Você será notificado por e-mail assim que sua conta for revisada por um administrador do grupo.</p>
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
