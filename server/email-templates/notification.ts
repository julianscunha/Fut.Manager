/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nodemailer (SMTP) template — Generic Notification
 *
 * A reusable template for any type of user notification.
 *
 * For Supabase Auth import, replace dynamic parts with Handlebars:
 *   - appName  -> {{ .SiteName }}
 *   - userName -> {{ .User.name }}
 *   - title    -> {{ .Title }}
 *   - message  -> {{ .Message }}
 *   - actionUrl    -> {{ .ActionURL }}
 *   - actionLabel  -> {{ .ActionLabel }}
 */
export function notificationTemplate(params: {
  userName: string;
  title: string;
  message: string;
  appName: string;
  actionUrl?: string;
  actionLabel?: string;
}): { subject: string; html: string } {
  const { userName, title, message, appName, actionUrl, actionLabel } = params;
  return {
    subject: title,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0a0f0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; background-color: #131a15; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; color: #d4d4d4; font-size: 13px; }
    .badge { display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 10px; }
    .body { padding: 28px 24px; }
    .body p { margin: 0 0 12px; color: #e4e4e7; font-size: 15px; line-height: 1.6; }
    .body .info { background-color: #0a0f0d; border: 1px solid #27272a; border-radius: 12px; padding: 14px 16px; margin: 16px 0; font-size: 13px; color: #a1a1aa; }
    .body .note { color: #71717a; font-size: 12px; line-height: 1.5; }
    .btn { display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; letter-spacing: -0.01em; }
    .btn-secondary { display: inline-block; background-color: transparent; color: #16a34a; font-size: 14px; font-weight: 700; text-decoration: none; padding: 11px 27px; border-radius: 12px; letter-spacing: -0.01em; border: 1px solid #16a34a; }
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
            <h1>${title}</h1>
            <p>Notificacao do <strong>${appName}</strong></p>
            <span class="badge">Novo</span>
          </div>
          <div class="body">
            <p>Olá, <strong>${userName}</strong>,</p>
            <p>${message}</p>
            <div class="info">
              <strong>${title}</strong>
            </div>
            ${actionUrl ? `
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <a href="${actionUrl}" target="_blank" class="btn">${actionLabel || 'Ver detalhes'}</a>
                </td>
              </tr>
            </table>
            ` : ''}
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
