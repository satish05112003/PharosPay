const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });
      console.log(`[EmailService] SMTP Transporter configured for ${host}:${port}`);
    } else {
      this.transporter = null;
      console.warn('[EmailService] SMTP details missing in .env. Falling back to log-only console mock.');
    }

    this.fromEmail = process.env.SMTP_FROM || 'PharosPay Support <support@pharospay.xyz>';
  }

  /**
   * General-purpose email dispatcher
   */
  async sendMail({ to, subject, html, text, attachments }) {
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.fromEmail,
          to,
          subject,
          text,
          html,
          attachments
        });
        console.log(`[EmailService] Email sent successfully: ${info.messageId}`);
        return info;
      } catch (err) {
        console.error('[EmailService] Failed to send email via SMTP:', err.message);
        throw err;
      }
    } else {
      console.log(`
┌─── [MOCK EMAIL DISPATCHED] ──────────────────────────────────────────────
│ To:      ${to}
│ Subject: ${subject}
│ Text:    ${text || '(HTML Only)'}
│ Attachments: ${attachments ? attachments.map(a => a.filename).join(', ') : 'None'}
└──────────────────────────────────────────────────────────────────────────
      `);
      return { messageId: `mock_${Date.now()}` };
    }
  }

  /**
   * Branded user ticket confirmation email
   */
  async sendTicketConfirmation(userEmail, ticket) {
    const subject = `[PharosPay Support] Ticket Created - ${ticket.ticketNumber}`;
    const text = `Hello,

Your support ticket ${ticket.ticketNumber} has been received. 

Subject: ${ticket.subject}
Priority: ${ticket.priority.toUpperCase()}
Category: ${ticket.category}
Status: ${ticket.status.toUpperCase()}

Expected response timeframe: within ${ticket.slaHours} hours.
Track your ticket at: https://pharospay.xyz/support/tickets/${ticket.id}

Thank you,
PharosPay Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Support Ticket Received</h2>
        <p>Hello,</p>
        <p>We've received your support ticket and our team is already on it.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f8fafc;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #e2e8f0;">Ticket Number</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${ticket.ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #e2e8f0;">Subject</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${ticket.subject}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #e2e8f0;">Priority</td>
            <td style="padding: 10px; color: #ef4444; font-weight: bold; border: 1px solid #e2e8f0;">${ticket.priority.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #e2e8f0;">SLA Response Time</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">Within ${ticket.slaHours} hour(s)</td>
          </tr>
        </table>
        <div style="margin: 30px 0; text-align: center;">
          <a href="https://pharospay.xyz/support/tickets/${ticket.id}" style="background: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Ticket Status</a>
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          This is an automated message from PharosPay. Please do not reply directly to this email.
        </p>
      </div>
    `;

    return this.sendMail({ to: userEmail, subject, text, html });
  }

  /**
   * Branded Admin alert for escalated tickets
   */
  async sendAdminAlert(adminEmail, ticket, contactInfo, aiAnalysis) {
    const subject = `[URGENT] PharosPay Ticket Escalation - ${ticket.ticketNumber} [${ticket.priority.toUpperCase()}]`;
    const text = `Urgent support ticket escalated.

Ticket: ${ticket.ticketNumber}
Wallet: ${ticket.userWallet}
Severity: ${ticket.priority.toUpperCase()}
Category: ${ticket.category}
Description: ${ticket.description}

Contact Details:
- Email: ${contactInfo.email || 'None'}
- Telegram: ${contactInfo.telegram || 'None'}
- Discord: ${contactInfo.discord || 'None'}

AI Analysis Summary:
- Confidence: ${(aiAnalysis.confidence * 100).toFixed(0)}%
- Root Cause: ${aiAnalysis.rootCause || 'Unknown'}
- Estimated Time: ${aiAnalysis.estimatedResolution || 'Unknown'}

Manage at: https://pharospay.xyz/merchant`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fca5a5; border-radius: 8px;">
        <h2 style="color: #dc2626; border-bottom: 2px solid #fee2e2; padding-bottom: 10px;">⚠️ Ticket Escalation Alert</h2>
        <p>A new ticket has been escalated requiring administrative intervention.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #fee2e2;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #fee2e2;">Ticket Number</td>
            <td style="padding: 10px; border: 1px solid #fee2e2; font-weight: bold;">${ticket.ticketNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #e2e8f0;">Severity</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: bold;">${ticket.priority.toUpperCase()}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #e2e8f0;">User Wallet</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">${ticket.userWallet}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #e2e8f0;">User Description</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${ticket.description}</td>
          </tr>
        </table>

        <h3 style="color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Contact Info</h3>
        <ul style="padding-left: 20px;">
          <li><strong>Email:</strong> ${contactInfo.email || 'Not provided'}</li>
          <li><strong>Telegram:</strong> ${contactInfo.telegram || 'Not provided'}</li>
          <li><strong>Discord:</strong> ${contactInfo.discord || 'Not provided'}</li>
        </ul>

        <h3 style="color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">AI Diagnosis</h3>
        <ul style="padding-left: 20px;">
          <li><strong>Confidence:</strong> ${(aiAnalysis.confidence * 100).toFixed(0)}%</li>
          <li><strong>Hypothesized Root Cause:</strong> ${aiAnalysis.rootCause || 'N/A'}</li>
          <li><strong>Resolution Time SLA:</strong> ${aiAnalysis.estimatedResolution || 'N/A'}</li>
        </ul>

        <div style="margin: 30px 0; text-align: center;">
          <a href="https://pharospay.xyz/merchant" style="background: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Access Administrative Panel</a>
        </div>
      </div>
    `;

    return this.sendMail({ to: adminEmail, subject, text, html });
  }

  /**
   * Resolution confirmation email
   */
  async sendTicketResolved(userEmail, ticket, resolution) {
    const subject = `[Resolved] Support Ticket - ${ticket.ticketNumber}`;
    const text = `Hello,\n\nYour support ticket ${ticket.ticketNumber} has been marked as RESOLVED.\n\nResolution: ${resolution}\n\nIf you have further questions, you can respond directly in the support center.\n\nBest regards,\nPharosPay Support`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #10b981; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">✅ Support Ticket Resolved</h2>
        <p>Hello,</p>
        <p>Your support ticket <strong>${ticket.ticketNumber}</strong> has been resolved by our support team.</p>
        <div style="background: #f0fdf4; padding: 15px; border-left: 4px solid #10b981; border-radius: 4px; margin: 20px 0;">
          <strong>Resolution:</strong><br/>
          ${resolution}
        </div>
        <p>If this was not resolved to your satisfaction, you can reopen the ticket by replying in the app support tab.</p>
      </div>
    `;
    return this.sendMail({ to: userEmail, subject, text, html });
  }

  /**
   * PDF receipt delivery email
   */
  async sendReceiptEmail(userEmail, paymentId, pdfBuffer) {
    const subject = `Your PharosPay Payment Receipt [Payment ID: ${paymentId}]`;
    const text = `Hello,\n\nPlease find attached your cryptographic payment receipt for Payment ID: ${paymentId}.\n\nThank you for choosing PharosPay!`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">PharosPay Payment Receipt</h2>
        <p>Hello,</p>
        <p>Your payment with PharosPay was completed. We have attached the cryptographic receipt to this email.</p>
        <p>You can also verify this receipt's authenticity at: <a href="https://pharospay.xyz/verify">pharospay.xyz/verify</a></p>
      </div>
    `;
    return this.sendMail({
      to: userEmail,
      subject,
      text,
      html,
      attachments: [{
        filename: `receipt-${paymentId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });
  }
}

module.exports = new EmailService();
