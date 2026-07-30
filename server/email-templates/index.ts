/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Email Templates — Central Export
 *
 * Templates follow the visual identity of the Fut.Manager web application
 * (dark theme, emerald/green primary, football/sports branding).
 *
 * Two categories of templates are provided:
 * 1. Nodemailer templates (use JS template literals `${...}`)
 * 2. Supabase Auth-compatible templates (use Handlebars `{{ .Variable }}`)
 *
 * Usage:
 *   import { passwordResetTemplate } from './email-templates';
 *   const { subject, html } = passwordResetTemplate({ ... });
 *   await sendEmail(user.email, subject, html);
 */

export { passwordResetTemplate } from './password-reset';
export { registrationApprovedTemplate } from './registration-approved';
export { registrationRejectedTemplate } from './registration-rejected';
export { registrationPendingTemplate } from './registration-pending';
export { notificationTemplate } from './notification';
export { supabasePasswordResetHtml, supabaseWelcomeHtml } from './supabase-templates';
