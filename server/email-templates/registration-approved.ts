/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseHtml, GRADIENTS } from './base';

export function registrationApprovedTemplate(params: {
  userName: string;
  userRole: string;
  appName: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const { userName, userRole, appName, loginUrl } = params;
  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    auxiliar: 'Auxiliar',
    jogador: 'Jogador',
  };
  const roleLabel = roleLabels[userRole] || userRole;
  const subject = `Conta aprovada no ${appName}`;

  const body = `
    <p>Olá, <strong>${userName}</strong>!</p>
    <p>Boa notícia: seu cadastro no <strong>${appName}</strong> foi aprovado. Você já pode acessar o painel com seu login e senha.</p>
    <div class="info-card">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td class="label">Grupo</td><td class="value" align="right">${appName}</td></tr>
        <tr><td class="label">Perfil</td><td class="value" align="right">${roleLabel}</td></tr>
        <tr><td class="label">Status</td><td class="value success" align="right">Aprovado</td></tr>
      </table>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="btn-wrap">
          <a href="${loginUrl}" target="_blank" class="btn">Acessar painel</a>
        </td>
      </tr>
    </table>
    <p class="note">Se tiver qualquer problema para entrar, é só responder a este e-mail que a gente ajuda.</p>
  `;

  return {
    subject,
    html: baseHtml({
      headerTitle: 'Conta aprovada',
      headerSubtitle: appName,
      headerGradient: GRADIENTS.success,
      body,
      subject,
      appName,
    }),
  };
}
