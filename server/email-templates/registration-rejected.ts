/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseHtml, GRADIENTS } from './base';

export function registrationRejectedTemplate(params: {
  userName: string;
  appName: string;
  rejectionReason: string;
}): { subject: string; html: string } {
  const { userName, appName, rejectionReason } = params;
  const subject = `Cadastro atualizado — ${appName}`;
  const body = `
    <p>Olá, <strong>${userName}</strong>,</p>
    <p>Sua solicitação de cadastro no <strong>${appName}</strong> foi revisada e a decisão final é a seguinte:</p>
    <div class="info-card" style="border-color:#b91c1c44;">
      <div class="row"><span class="label">Motivo</span></div>
      <p style="margin:4px 0 0;color:#fca5a5;font-size:13px;line-height:1.5;">${rejectionReason}</p>
    </div>
    <p style="margin-top:16px;">Caso tenha dúvidas sobre a decisão ou queira enviar uma nova solicitação, entre em contato com um administrador do grupo.</p>
  `;
  return {
    subject,
    html: baseHtml({
      headerTitle: 'Cadastro Atualizado',
      headerSubtitle: appName,
      headerGradient: GRADIENTS.danger,
      body,
      subject,
      appName,
    }),
  };
}