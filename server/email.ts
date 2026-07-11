/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import nodemailer from 'nodemailer';

// SMTP genérico (não amarrado a um provedor específico) — qualquer instalação escolhe seu próprio
// serviço (Resend, SendGrid, Mailgun, SES, Gmail, servidor próprio) só configurando essas variáveis,
// sem precisar trocar código. Se SMTP_HOST não estiver setado, e-mail transacional fica indisponível
// e quem chamar sendEmail() deve tratar isso (ver uso em server.ts: /api/auth/forgot-password).
export function isEmailConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;

  const port = Number(process.env.SMTP_PORT || 587);
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = TLS implícito; 587/25 = STARTTLS negociado pelo próprio nodemailer
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return cachedTransporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('SMTP não configurado (defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM).');
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}
