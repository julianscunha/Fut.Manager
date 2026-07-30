/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface EmailResult {
  success: boolean;
  provider: 'turbosmtp';
  messageId: string | null;
  status: number;
}

const API_BASE = 'https://api.turbo-smtp.com/api/v2';
const TIMEOUT_MS = 10000;
const RETRYABLE_STATUSES = [500, 502, 503, 504];

export function isEmailConfigured(): boolean {
  return !!(process.env.TURBO_API_KEY && process.env.TURBO_API_SECRET);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    throw new Error('TurboSMTP não configurado (defina TURBO_API_KEY e TURBO_API_SECRET).');
  }

  const auth = btoa(`${process.env.TURBO_API_KEY}:${process.env.TURBO_API_SECRET}`);
  const from = process.env.EMAIL_FROM || process.env.TURBO_API_KEY;

  const attempt = async (): Promise<EmailResult> => {
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
          from,
          to,
          subject,
          html_body: html,
        }),
        signal: controller.signal,
      });

      const body = await response.text();
      const messageId = extractMessageId(body);

      console.log(`[sendEmail] Para: ${to} | Assunto: ${subject} | Status: ${response.status} | MessageId: ${messageId || 'N/A'}`);

      if (response.ok) {
        return { success: true, provider: 'turbosmtp', messageId, status: response.status };
      }

      const error = new Error(`TurboSMTP API erro ${response.status}: ${body}`);
      (error as any).status = response.status;
      throw error;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw Object.assign(new Error('TurboSMTP API timeout após 10s'), { status: 0 });
      }
      console.error('[sendEmail] Falha ao enviar e-mail:', err.message);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    return await attempt();
  } catch (err: any) {
    const status = err.status || 0;
    const isRetryable = status === 0 || RETRYABLE_STATUSES.includes(status);
    if (!isRetryable) throw err;

    console.log(`[sendEmail] Retry para ${to} (status ${status})`);
    return await attempt();
  }
}

function extractMessageId(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    return parsed.message_id || parsed.messageId || parsed.id || null;
  } catch {
    return null;
  }
}