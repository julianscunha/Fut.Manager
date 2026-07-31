/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseHtml, GRADIENTS } from './base';

export function welcomeTemplate(params: {
  userName: string;
  appName: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const { userName, appName, loginUrl } = params;
  const subject = `Bem-vindo ao ${appName}`;

  const body = `
    <p>Olá, <strong>${userName}</strong>!</p>
    <p>Tudo bem por aqui? Seja muito bem-vindo ao <strong>${appName}</strong>. Agora você faz parte do time.</p>
    <p>O app já está disponível para você usar: confira os próximos rachas, acompanhe presenças, veja o ranking e participe do mural do clube.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="btn-wrap">
          <a href="${loginUrl}" target="_blank" class="btn">Acessar o app</a>
        </td>
      </tr>
    </table>
    <p class="note">Qualquer dúvida, é só responder a este e-mail. Vamos juntos!</p>
  `;

  return {
    subject,
    html: baseHtml({
      headerTitle: 'Bem-vindo!',
      headerSubtitle: appName,
      headerGradient: GRADIENTS.success,
      body,
      subject,
      appName,
    }),
  };
}
