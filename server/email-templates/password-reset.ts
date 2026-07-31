/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseHtml, GRADIENTS } from './base';

export function passwordResetTemplate(params: {
  userName: string;
  resetUrl: string;
  appName: string;
  expiresInMinutes?: number;
}): { subject: string; html: string } {
  const { userName, resetUrl, appName, expiresInMinutes = 15 } = params;
  const subject = `Redefinição de senha — ${appName}`;

  const body = `
    <p>Olá, <strong>${userName}</strong>!</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta no <strong>${appName}</strong>. Se foi você mesmo, é só clicar no botão abaixo e escolher uma nova senha.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="btn-wrap">
          <a href="${resetUrl}" target="_blank" class="btn">Redefinir minha senha</a>
        </td>
      </tr>
    </table>
    <p class="note">Este link vale por <strong>${expiresInMinutes} minutos</strong>.</p>
    <p class="note">Se você não pediu essa redefinição, pode ignorar este e-mail com tranquilidade — sua senha continua a mesma.</p>
  `;

  return {
    subject,
    html: baseHtml({
      headerTitle: 'Redefinir senha',
      headerSubtitle: appName,
      headerGradient: GRADIENTS.success,
      body,
      subject,
      appName,
    }),
  };
}
