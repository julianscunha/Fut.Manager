/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supabase Auth Email Templates
 *
 * These templates use Handlebars syntax ({{ .Variable }}) for
 * compatibility with Supabase Auth Email Provider.
 *
 * Usage in Supabase Dashboard:
 *   Authentication -> Email Templates -> Edit built-in templates
 *
 * Or to customize via code, import the template strings and map
 * the variables at send time using your email provider SDK.
 *
 * Supabase provides these built-in variables:
 *   {{ .SiteURL }}           - Your site URL (from SITE_URL env)
 *   {{ .Token }}              - One-time token for action
 *   {{ .Email }}              - User email
 *   {{ .User.Name }}          - User display name (if set)
 *   {{ .ConfirmationURL }}    - Auto-generated confirm URL
 *   {{ .ResetPasswordURL }}   - Auto-generated password reset URL
 *   {{ .MagicLinkURL }}       - Auto-generated magic link URL
 */

/**
 * Supabase-compatible password reset email HTML.
 *
 * Replace placeholders in Supabase dashboard template body with this HTML,
 * or use in a custom email provider where you map variables manually.
 */
export const supabasePasswordResetHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinir senha</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0a0f0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; background-color: #131a15; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
    .body { padding: 28px 24px; }
    .body p { margin: 0 0 12px; color: #e4e4e7; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; }
    .note { color: #71717a; font-size: 12px; line-height: 1.5; }
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
            <h1>Redefinir senha</h1>
            <p>Sistema de gestao de racha</p>
          </div>
          <div class="body">
            <p>Olá,</p>
            <p>Recebemos um pedido de redefinição de senha para sua conta. Clique no botão abaixo para definir uma nova senha.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <a href="{{ .SiteURL }}/#/reset-password?token={{ .Token }}" target="_blank" class="btn">Redefinir minha senha</a>
                </td>
              </tr>
            </table>
            <p class="note">Este link é válido por 15 minutos.</p>
            <p class="note">Se você não pediu essa redefinição, simplesmente ignore este e-mail.</p>
          </div>
          <div class="footer">
            <p>&copy; {{ .SiteName }} Todos os direitos reservados.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

/**
 * Supabase-compatible welcome/confirmation email HTML.
 * Sent automatically when a new user confirms their email.
 */
export const supabaseWelcomeHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Boas-vindas</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0a0f0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; background-color: #131a15; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; }
    .body { padding: 28px 24px; }
    .body p { margin: 0 0 12px; color: #e4e4e7; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; }
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
            <h1>Boas-vindas</h1>
            <p>Sua conta foi confirmada com sucesso</p>
          </div>
          <div class="body">
            <p>Olá, <strong>{{ .User.Name }}</strong>,</p>
            <p>Sua conta no <strong>{{ .SiteName }}</strong> foi confirmada. Você agora pode fazer login e acessar o painel.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <a href="{{ .SiteURL }}" target="_blank" class="btn">Acessar painel</a>
                </td>
              </tr>
            </table>
          </div>
          <div class="footer">
            <p>&copy; {{ .SiteName }} Todos os direitos reservados.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
