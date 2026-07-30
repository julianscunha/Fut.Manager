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
  const isSecure = port === 465;

  const tlsConfig = {
    rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
    minVersion: 'TLSv1.2',
  };

  const customArgs = process.env.SMTP_CUSTOM_ARGS
    ? JSON.parse(process.env.SMTP_CUSTOM_ARGS)
    : {};

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: isSecure,
    tls: tlsConfig,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 5000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 10000),
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 5),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    ...customArgs,
  });

  return cachedTransporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('SMTP não configurado (defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM).');
  }

  const transporter = getTransporter();

  try {
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log(`[sendEmail] Enviado para ${to}, messageId: ${result.messageId}`);
  } catch (err) {
    console.error('[sendEmail] Falha ao enviar e-mail para', to, err);
    throw err;
  }
}