import React from 'react';

export default function ConversationExport({ ticket, messages }) {
  const handlePrint = () => {
    // Generate custom HTML string for print
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocker is active. Please enable pop-ups to export transcripts.');
      return;
    }

    const messagesHtml = messages.map(m => `
      <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #e2e8f0; font-family: sans-serif; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; color: #475569; margin-bottom: 4px;">
          <span>${m.sender_name || m.senderName} (${m.sender_type || m.senderType})</span>
          <span style="font-size: 11px; font-weight: normal; color: #94a3b8;">${new Date(m.created_at || m.createdAt).toLocaleString()}</span>
        </div>
        <p style="margin: 0; line-height: 1.4; color: #1e293b; white-space: pre-wrap;">${m.message || m.content}</p>
      </div>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Transcript_${ticket.ticket_number || ticket.ticketNumber}</title>
          <style>
            @media print {
              body { margin: 20px; color: #1e293b; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #1e293b;">
          <div style="border-bottom: 3px solid #6366f1; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; color: #6366f1;">PHAROSPAY SUPPORT TRANSCRIPT</h2>
              <span style="font-size: 12px; color: #64748b;">Cryptographic blockchain payments infrastructure support ticket</span>
            </div>
            <button class="no-print" onclick="window.print()" style="background: #6366f1; border: none; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
              Print / Save PDF
            </button>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
            <tr style="background: #f8fafc;">
              <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0; width: 30%;">Ticket Number</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${ticket.ticket_number || ticket.ticketNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">User Wallet</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${ticket.user_wallet || ticket.userWallet}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Category</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-transform: capitalize;">${ticket.category}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Priority / Severity</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; text-transform: uppercase; font-weight: bold;">${ticket.priority}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Subject</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${ticket.subject}</td>
            </tr>
          </table>

          <h3 style="color: #475569; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 16px;">Conversation Log</h3>
          ${messagesHtml}
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <button
      onClick={handlePrint}
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
        borderRadius: '6px',
        padding: '6px 12px',
        color: 'var(--text)',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}
    >
      <span>📥</span> Export Chat PDF
    </button>
  );
}
