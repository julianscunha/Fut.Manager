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
    <p>Olá, <strong>${userName}</strong>,</p>
    <p>Sua solicitação de cadastro no <strong>${appName}</strong> foi <strong style="color:#22c55e;">aprovada</strong> pelo administrador.</p>
    <div class="info-card">
      <div class="row"><span class="label">Grupo</span><span class="value">${appName}</span></div>
      <div class="row"><span class="label">Perfil</span><span class="value">${roleLabel}</span></div>
      <div class="row"><span class="label">Status</span><span class="value success">Aprovado</span></div>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="btn-wrap">
          <a href="${loginUrl}" target="_blank" class="btn">Acessar painel</a>
        </td>
      </tr>
    </table>
    <p class="note">Agora você pode fazer login e acessar o painel completo do ${appName}.</p>
  `;
  return {
    subject,
    html: baseHtml({
      headerTitle: 'Conta Aprovada',
      headerSubtitle: appName,
      headerGradient: GRADIENTS.success,
      body,
      subject,
      appName,
    }),
  };
}