/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseHtml, GRADIENTS } from './base';

export function registrationPendingTemplate(params: {
  userName: string;
  appName: string;
  estimatedWaitDays?: number;
}): { subject: string; html: string } {
  const { userName, appName, estimatedWaitDays = 2 } = params;
  const subject = `Cadastro recebido — ${appName}`;

  const body = `
    <p>Olá, <strong>${userName}</strong>!</p>
    <p>Recebemos seu cadastro no <strong>${appName}</strong> e está tudo certo por aqui. Agora é só aguardar a aprovação de um administrador para você entrar no app.</p>
    <div class="info-card">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td class="label">Status</td><td class="value pending" align="right">Aguardando aprovação</td></tr>
        <tr><td class="label">Tempo estimado</td><td class="value" align="right">~${estimatedWaitDays} dia(s)</td></tr>
      </table>
    </div>
    <p class="note">Assim que sua conta for aprovada, você recebe outro e-mail por aqui — pode deixar a caixa de entrada à vontade.</p>
  `;

  return {
    subject,
    html: baseHtml({
      headerTitle: 'Cadastro recebido',
      headerSubtitle: appName,
      headerGradient: GRADIENTS.pending,
      body,
      subject,
      appName,
    }),
  };
}
