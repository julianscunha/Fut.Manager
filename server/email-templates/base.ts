/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared design tokens, CSS, and HTML shell for all email templates.
 * Every template derives its look from this single source of truth.
 */

export const tokens = {
  bg: '#0a0e0c',
  card: '#141b17',
  border: '#1f2923',
  text: '#e4e4e7',
  muted: '#6b7280',
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
    max-width: 480px; width: 100%;
    margin: 0 auto;
    background-color: ${tokens.card};
    border: 1px solid ${tokens.border};
    border-radius: 16px;
    overflow: hidden;
  }
  .header {
    padding: 32px 24px 28px;
    text-align: center;
  }
  .header h1 {
    margin: 0;
    font-size: 22px; font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .header p {
    margin: 6px 0 0;
    color: #d4d4d8;
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
    padding: 28px 24px;
  }
  .body p {
    margin: 0 0 14px;
    color: ${tokens.text};
    font-size: 15px;
    line-height: 1.7;
  }
  .body p:last-child {
    margin-bottom: 0;
  }
  .body .note {
    color: ${tokens.muted};
    font-size: 13px;
    line-height: 1.5;
  }
  .body .note strong {
    color: ${tokens.accentLight};
  }
  .info-card {
    background-color: ${tokens.bg};
    border: 1px solid ${tokens.border};
    border-radius: 12px;
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
    color: #38bdf8;
  }
  .btn-wrap {
    padding: 16px 0 8px;
    text-align: center;
  }
  .btn {
    display: inline-block;
    background-color: ${tokens.accent};
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    padding: 13px 32px;
    border-radius: 10px;
    letter-spacing: -0.01em;
    line-height: 1.4;
  }
  .footer {
    border-top: 1px solid ${tokens.border};
    padding: 16px 24px;
    text-align: center;
  }
  .footer p {
    margin: 0;
    color: ${tokens.muted};
    font-size: 11px;
    line-height: 1.5;
  }
  @media only screen and (max-width: 480px) {
    .header { padding: 24px 20px 20px; }
    .header h1 { font-size: 19px; }
    .body { padding: 24px 20px; }
    .body p { font-size: 14px; }
    .btn { display: block; padding: 14px 24px; }
    .info-card { padding: 12px; }
    .footer { padding: 12px 20px; }
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
  <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0;"><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${tokens.bg};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" class="card">
          <tr>
            <td class="header" style="background:${params.headerGradient};">
              <h1>${params.headerTitle}</h1>
              <p>${params.headerSubtitle}</p>
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
              <p>&copy; ${new Date().getFullYear()} ${params.appName}. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}