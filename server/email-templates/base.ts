/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared design tokens, CSS, and HTML shell for all email templates.
 * Every template derives its look from this single source of truth.
 */

export const tokens = {
  bg: '#111815',        // Cinza grafite profundo (mesmo tom do dashboard)
  card: '#ffffff',      // Branco puro para máxima legibilidade
  border: '#e5e7eb',    // Cinza claro neutro para bordas sutis
  text: '#1f2937',      // Cinza escuro para leitura confortável
  muted: '#6b7280',     // Cinza médio para textos secundários
  accent: '#059669',    // Esmeralda vibrante (mesma família do turf-glow do app)
  accentLight: '#10b981',
  accentDim: '#065f46',
  divider: '#e5e7eb',
  pending: '#0284c7',   // Azul — aguardando ação externa
  warning: '#d97706',   // Âmbar — aguardando ação do usuário
  danger: '#b91c1c',    // Vermelho — rejeição/erro
};

export const GRADIENTS = {
  success: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  danger: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)',
  pending: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
  neutral: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
};

export const sharedCss = `
  body {
    margin: 0; padding: 0;
    background-color: ${tokens.bg};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    max-width: 520px; width: 100%;
    margin: 0 auto;
    background-color: ${tokens.card};
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
  }
  .header {
    padding: 32px;
    text-align: center;
  }
  .header-title {
    margin: 0;
    font-size: 22px; font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .header-subtitle {
    margin: 8px 0 0;
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
    font-weight: 500;
  }
  .pitch {
    height: 6px;
    background: ${tokens.accent};
  }
  .body {
    padding: 32px;
  }
  .body p {
    margin: 0 0 16px;
    color: ${tokens.text};
    font-size: 16px;
    line-height: 1.6;
  }
  .body p:last-child {
    margin-bottom: 0;
  }
  .body .note {
    color: ${tokens.muted};
    font-size: 13px;
    line-height: 1.5;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid ${tokens.border};
  }
  .info-card {
    background-color: #f9fafb;
    border: 1px solid ${tokens.border};
    border-radius: 12px;
    padding: 20px;
    margin: 24px 0;
  }
  .info-card table {
    width: 100%;
    border-collapse: collapse;
  }
  .info-card tr + tr td {
    border-top: 1px solid ${tokens.border};
  }
  .info-card td {
    padding: 8px 0;
    vertical-align: middle;
  }
  .info-card .label {
    color: ${tokens.muted};
    font-size: 13px;
    text-align: left;
  }
  .info-card .value {
    color: ${tokens.text};
    font-size: 13px;
    font-weight: 700;
    text-align: right;
  }
  .info-card .value.success {
    color: ${tokens.accent};
  }
  .info-card .value.pending {
    color: ${tokens.pending};
  }
  .info-card .value.warning {
    color: ${tokens.warning};
  }
  .btn-wrap {
    padding: 24px 0 8px;
    text-align: center;
  }
  .btn {
    display: inline-block;
    background-color: ${tokens.accent};
    color: #ffffff;
    font-size: 15px;
    font-weight: 700;
    text-decoration: none;
    padding: 14px 28px;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .footer {
    padding: 24px 32px;
    text-align: center;
    background: #f9fafb;
  }
  .footer p {
    margin: 0 0 8px;
    color: ${tokens.muted};
    font-size: 11px;
    line-height: 1.6;
  }
  .footer a {
    color: ${tokens.muted};
    text-decoration: underline;
  }
`;

export function baseHtml(params: {
  headerTitle: string;
  headerSubtitle: string;
  headerGradient: string;
  body: string;
  subject: string;
  appName: string;
}): string {
  const appUrl = process.env.APP_URL || 'https://rachadofofim.com.br';
  const supportEmail = 'naoresponda@rachadofofim.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${params.subject}</title>
  <style>${sharedCss}</style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${tokens.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card">
          <tr>
            <td class="header" style="background:${params.headerGradient};">
              <h1 class="header-title">${params.headerTitle}</h1>
              <p class="header-subtitle">${params.headerSubtitle}</p>
            </td>
          </tr>
          <tr>
            <td style="height:4px;font-size:0;line-height:0;" class="pitch"></td>
          </tr>
          <tr>
            <td class="body">
              ${params.body}
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p>
                <a href="${appUrl}">${appUrl.replace(/^https?:\/\//, '')}</a>
                &nbsp;·&nbsp;
                <a href="mailto:${supportEmail}">Suporte</a>
              </p>
              <p>&copy; ${new Date().getFullYear()} ${params.appName}. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
