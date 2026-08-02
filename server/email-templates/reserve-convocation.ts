/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseHtml, GRADIENTS } from './base';

export function reserveConvocationTemplate(params: {
  playerName: string;
  matchDate: string;
  matchTime: string;
  appName: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const { playerName, matchDate, matchTime, appName, loginUrl } = params;
  const subject = `Você foi convocado para o racha de ${matchDate}`;

  const body = `
    <p>Olá, <strong>${playerName}</strong>!</p>
    <p>Você foi convocado da lista de prioridades para preencher uma vaga no próximo racha. Responda o quanto antes para confirmar ou recusar sua presença.</p>
    <div class="info-card">
      <div class="row"><span class="label">Grupo</span><span class="value">${appName}</span></div>
      <div class="row"><span class="label">Data</span><span class="value">${matchDate}</span></div>
      <div class="row"><span class="label">Horário</span><span class="value">${matchTime}</span></div>
      <div class="row"><span class="label">Status</span><span class="value success">Aguardando sua resposta</span></div>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="btn-wrap">
          <a href="${loginUrl}" target="_blank" class="btn">Responder convocação</a>
        </td>
      </tr>
    </table>
    <p class="note">Se não puder comparecer, recuse a convocação para que o próximo reserva da fila seja chamado.</p>
  `;

  return {
    subject,
    html: baseHtml({
      headerTitle: 'Convocação de Reserva',
      headerSubtitle: appName,
      headerGradient: GRADIENTS.pending,
      body,
      subject,
      appName,
    }),
  };
}
