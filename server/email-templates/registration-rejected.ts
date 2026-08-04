/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseHtml, GRADIENTS, tokens } from './base';

export function registrationRejectedTemplate(params: {
  userName: string;
  appName: string;
  rejectionReason: string;
}): { subject: string; html: string } {
  const { userName, appName, rejectionReason } = params;
  const subject = `Atualização do seu cadastro — ${appName}`;

  const body = `
    <p>Olá, <strong>${userName}</strong>.</p>
    <p>Depois de revisar seu cadastro, não conseguimos liberar o acesso desta vez. Abaixo você vê o motivo:</p>
    <div class="info-card" style="border-color:${tokens.danger}55;">
      <p class="label" style="margin:0;">Motivo</p>
      <p style="margin:4px 0 0;color:${tokens.danger};font-size:13px;line-height:1.5;">${rejectionReason}</p>
    </div>
    <p style="margin-top:16px;">Se achar que foi algum engano ou quiser tentar novamente, é só falar com um administrador do grupo.</p>
  `;

  return {
    subject,
    html: baseHtml({
      headerTitle: 'Atualização do cadastro',
      headerSubtitle: appName,
      headerGradient: GRADIENTS.danger,
      body,
      subject,
      appName,
    }),
  };
}
