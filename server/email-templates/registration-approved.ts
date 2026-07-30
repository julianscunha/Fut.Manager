/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nodemailer (SMTP) template — Registration Approved Notification
 *
 * Sent to a user when an admin approves their registration.
 *
 * For Supabase Auth import, replace dynamic parts with Handlebars:
 *   - appName → {{ .SiteName }}
 *   - userName → {{ .User.name }}.
 *   - userRole → {{ .User.role_label }}  (set by your trigger or auth hook)
 */
export function registrationApprovedTemplate(params: {
  userName: string;
  userRole: string;
  appName: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const { userName, userRole, appName, loginUrl } = params;
  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    auxiliar: 'Auxiliar',
    jogador: 'Jogador',
  };
  const roleLabel = roleLabels[userRole] || userRole;
  return {
    subject: `Conta aprovada no ${appName}`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Conta aprovada — ${appName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0a0f0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; background-color: #131a15; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; color: #d4d4d4; font-size: 13px; }
    .badge { display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 10px; }
    .body { padding: 28px 24px; }
    .body p { margin: 0 0 12px; color: #e4e4e7; font-size: 15px; line-height: 1.6; }
    .body .info { background-color: #0a0f0d; border: 1px solid #27272a; border-radius: 12px; padding: 14px 16px; margin: 16px 0; }
    .body .info-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .body .info-label { color: #71717a; font-size: 12px; }
    .body .info-value { color: #e4e4e7; font-size: 12px; font-weight: 600; }
    .btn { display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; letter-spacing: -0.01em; }
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
            <h1>Conta Aprovada</h1>
            <p>Para o grupo <strong>${appName}</strong></p>
            <span class="badge">${roleLabel}</span>
          </div>
          <div class="body">
            <p>Olá, <strong>${userName}</strong>,</p>
            <p>Sua solicitação de cadastro no <strong>${appName}</strong> foi <strong style="color:#22c55e;">aprovada</strong> pelo administrador do grupo.</p>
            <div class="info">
              <div class="info-row"><span class="info-label">Grupo</span><span class="info-value">${appName}</span></div>
              <div class="info-row"><span class="info-label">Perfil</span><span class="info-value">${roleLabel}</span></div>
              <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:#22c55e;">Aprovado</span></div>
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <a href="${loginUrl}" target="_blank" class="btn">Acessar painel</a>
                </td>
              </tr>
            </table>
            <p class="note">Agora você pode fazer login e acessar o painel completo do ${appName}.</p>
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
