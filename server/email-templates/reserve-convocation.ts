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
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td class="label">Grupo</td><td class="value" align="right">${appName}</td></tr>
        <tr><td class="label">Data</td><td class="value" align="right">${matchDate}</td></tr>
        <tr><td class="label">Horário</td><td class="value" align="right">${matchTime}</td></tr>
        <tr><td class="label">Status</td><td class="value warning" align="right">Aguardando sua resposta</td></tr>
      </table>
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
