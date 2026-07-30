/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const API_BASE = 'https://api.turbo-smtp.com/api/v2';
const TIMEOUT_MS = 10000;

export function isEmailConfigured(): boolean {
  return !!(process.env.TURBO_API_KEY && process.env.TURBO_API_SECRET);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('TurboSMTP não configurado (defina TURBO_API_KEY e TURBO_API_SECRET).');
  }

  const auth = btoa(`${process.env.TURBO_API_KEY}:${process.env.TURBO_API_SECRET}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/mail/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || process.env.TURBO_API_KEY,
        to,
        subject,
        html_body: html,
      }),
      signal: controller.signal,
    });

    const body = await response.text();

    console.log(`[sendEmail] Para: ${to} | Assunto: ${subject} | Status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`TurboSMTP API erro ${response.status}: ${body}`);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('TurboSMTP API timeout após 10s');
    }
    console.error('[sendEmail] Falha ao enviar e-mail:', err.message);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}