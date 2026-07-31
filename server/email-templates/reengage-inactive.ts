/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseHtml, GRADIENTS } from './base';

export function reengageInactiveTemplate(params: {
  userName: string;
  appName: string;
  loginUrl: string;
  monthsInactive: number;
}): { subject: string; html: string } {
  const { userName, appName, loginUrl, monthsInactive } = params;
  const subject = `${userName}, faz tempo que não te vemos por aqui...`;

  const body = `
    <p>Olá, <strong>${userName}</strong>,</p>
    <p>Faz um tempo que você não aparece no <strong>${appName}</strong>, e por aqui todo mundo já está sentindo sua falta.</p>
    <p>Seja por lesão, trabalho, compromisso da vida ou qualquer outro motivo, a gente entende. Mas se já estiver tudo bem por aí, saiba que as portas estão abertas quando você quiser voltar.</p>
    <div class="info-card">
      <div class="row"><span class="label">Status atual</span><span class="value">Indisponível</span></div>
      <div class="row"><span class="label">Tempo afastado</span><span class="value">${monthsInactive} ${monthsInactive === 1 ? 'mês' : 'meses'}</span></div>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="btn-wrap">
          <a href="${loginUrl}" target="_blank" class="btn">Voltar para o app</a>
        </td>
      </tr>
    </table>
    <p class="note">Se quiser atualizar sua disponibilidade ou falar com a administração, é só acessar o app. Sem pressão — a gente fica feliz só em ter você de volta.</p>
  `;

  return {
    subject,
    html: baseHtml({
      headerTitle: 'Sentimos sua falta',
      headerSubtitle: appName,
      headerGradient: GRADIENTS.neutral,
      body,
      subject,
      appName,
    }),
  };
}
