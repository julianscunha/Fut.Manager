/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseHtml, GRADIENTS } from './base';

export function notificationTemplate(params: {
  userName: string;
  title: string;
  message: string;
  appName: string;
  actionUrl?: string;
  actionLabel?: string;
}): { subject: string; html: string } {
  const { userName, title, message, appName, actionUrl, actionLabel } = params;

  const body = `
    <p>Olá, <strong>${userName}</strong>,</p>
    <p>${message}</p>
    ${actionUrl ? `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="btn-wrap">
          <a href="${actionUrl}" target="_blank" class="btn">${actionLabel || 'Ver detalhes'}</a>
        </td>
      </tr>
    </table>
    ` : ''}
  `;

  return {
    subject: title,
    html: baseHtml({
      headerTitle: title,
      headerSubtitle: appName,
      headerGradient: GRADIENTS.neutral,
      body,
      subject: title,
      appName,
    }),
  };
}
