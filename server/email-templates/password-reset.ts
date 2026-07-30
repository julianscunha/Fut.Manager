/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nodemailer (SMTP) template — Password Reset (Forgot Password)
 *
 * Also compatible with Supabase Auth. The `{{ .SiteURL }}` and `{{ .Token }}`
 * placeholders below use native JavaScript template literals (`${...}`) for
 * Nodemailer. For Supabase import, replace dynamic parts with Handlebars:
 *   - resetUrl  → {{ .SiteURL }}/?resetToken={{ .Token }}&resetUserId={{ .User.id }}
 *   - appName   → {{ .SiteName }}
 */
export function passwordResetTemplate(params: {
  userName: string;
  resetUrl: string;
  appName: string;
  expiresInMinutes?: number;
}): { subject: string; html: string } {
  const { userName, resetUrl, appName, expiresInMinutes = 15 } = params;
  return {
    subject: `Redefinição de senha — ${appName}`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinir senha — ${appName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0a0f0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; background-color: #131a15; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; color: #d4d4d4; font-size: 13px; }
    .body { padding: 28px 24px; }
    .body p { margin: 0 0 12px; color: #e4e4e7; font-size: 15px; line-height: 1.6; }
    .body .note { color: #71717a; font-size: 12px; line-height: 1.5; }
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
            <h1>${appName}</h1>
            <p>Painel de gestão do seu racha</p>
          </div>
          <div class="body">
            <p>Olá, <strong>${userName}</strong>!</p>
            <p>Recebemos um pedido de redefinição de senha para sua conta no <strong>${appName}</strong>.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <a href="${resetUrl}" target="_blank" class="btn">Redefinir minha senha</a>
                </td>
              </tr>
            </table>
            <p class="note">Este link é válido por <strong>${expiresInMinutes} minutos</strong>.</p>
            <p class="note">Se você não pediu essa redefinição, simplesmente ignore este e-mail. Sua senha não será alterada.</p>
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
