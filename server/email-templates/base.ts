/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared design tokens, CSS, and HTML shell for all email templates.
 * Every template derives its look from this single source of truth.
 */

export const tokens = {
  bg: '#0a0e0c',
  card: '#f8f4ec',
  border: '#ddd3bf',
  text: '#1c1710',
  muted: '#6b6355',
  accent: '#1a8a4a',
  accentLight: '#22c55e',
  accentDim: '#145c32',
  divider: '#1a8a4a33',
};

export const GRADIENTS = {
  success: 'linear-gradient(135deg, #1a8a4a 0%, #22c55e 100%)',
  danger: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
  pending: 'linear-gradient(135deg, #0369a1 0%, #38bdf8 100%)',
  neutral: 'linear-gradient(135deg, #1a8a4a 0%, #34d399 100%)',
};

export const sharedCss = `
  body {
    margin: 0; padding: 0;
    background-color: ${tokens.bg};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  .card {
    max-width: 520px; width: 100%;
    margin: 0 auto;
    background-color: ${tokens.card};
    border-radius: 8px;
    overflow: hidden;
  }
  .header {
    padding: 24px 32px;
    text-align: center;
    border-bottom: 1px solid ${tokens.border};
  }
  .header-title {
    margin: 0;
    font-size: 18px; font-weight: 800;
    color: ${tokens.text};
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .header-subtitle {
    margin: 4px 0 0;
    color: ${tokens.muted};
    font-size: 13px;
    line-height: 1.4;
  }
  .pitch {
    height: 4px;
    background: repeating-linear-gradient(
      90deg,
      ${tokens.accent} 0px,
      ${tokens.accent} 6px,
      ${tokens.accentLight}33 6px,
      ${tokens.accentLight}33 12px,
      ${tokens.accent} 12px,
      ${tokens.accent} 18px,
      ${tokens.accentDim} 18px,
      ${tokens.accentDim} 24px
    );
  }
  .body {
    padding: 32px;
    font-family: Arial, Helvetica, sans-serif;
  }
  .body p {
    margin: 0 0 16px;
    color: ${tokens.text};
    font-size: 15px;
    line-height: 1.6;
  }
  .body p:last-child {
    margin-bottom: 0;
  }
  .body .note {
    color: ${tokens.muted};
    font-size: 12px;
    line-height: 1.5;
  }
  .info-card {
    background-color: ${tokens.bg};
    border: 1px solid ${tokens.border};
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
  }
  .info-card .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
  }
  .info-card .row + .row {
    border-top: 1px solid ${tokens.border};
  }
  .info-card .label {
    color: ${tokens.muted};
    font-size: 13px;
  }
  .info-card .value {
    color: ${tokens.text};
    font-size: 13px;
    font-weight: 600;
  }
  .info-card .value.success {
    color: ${tokens.accentLight};
  }
  .info-card .value.pending {
    color: #0ea5e9;
  }
  .btn-wrap {
    padding: 8px 0 16px;
    text-align: center;
  }
  .btn {
    display: inline-block;
    background-color: ${tokens.accent};
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    padding: 12px 24px;
    border-radius: 6px;
    letter-spacing: -0.01em;
    line-height: 1.4;
  }
  .footer {
    padding: 20px 32px;
    text-align: center;
    border-top: 1px solid ${tokens.border};
  }
  .footer p {
    margin: 0;
    color: ${tokens.muted};
    font-size: 12px;
    line-height: 1.5;
    font-family: Arial, Helvetica, sans-serif;
  }
  .footer a {
    color: ${tokens.muted};
    text-decoration: underline;
  }
  @media only screen and (max-width: 480px) {
    .header { padding: 20px; }
    .body { padding: 24px 20px; }
    .footer { padding: 16px 20px; }
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
