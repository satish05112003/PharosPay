const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const EmailService = require('../services/EmailService');

const worker = new Worker('support-email', async (job) => {
  const { name, data } = job;
  console.log(`[emailWorker] Processing email delivery job: ${job.id} - Name: ${name}`);

  try {
    switch (name) {
      case 'escalation_admin': {
        const { adminEmail, ticket, contactInfo, aiAnalysis } = data;
        await EmailService.sendAdminAlert(adminEmail, ticket, contactInfo, aiAnalysis);
        return { success: true };
      }

      case 'ticket_confirm': {
        const { email, ticket } = data;
        await EmailService.sendTicketConfirmation(email, ticket);
        return { success: true };
      }

      case 'ticket_resolved': {
        const { email, ticket, resolution } = data;
        await EmailService.sendTicketResolved(email, ticket, resolution);
        return { success: true };
      }

      case 'receipt_email': {
        const { email, paymentId, pdfBuffer } = data;
        // Reconstruct Buffer if it was serialized as a JSON object by BullMQ
        const buffer = pdfBuffer && pdfBuffer.type === 'Buffer' 
          ? Buffer.from(pdfBuffer.data) 
          : Buffer.from(pdfBuffer);
          
        await EmailService.sendReceiptEmail(email, paymentId, buffer);
        return { success: true };
      }

      default:
        console.warn(`[emailWorker] Unknown email job name: ${name}`);
        return { error: 'Unknown job name' };
    }
  } catch (err) {
    console.error(`[emailWorker] Job ${job.id} failed:`, err.message);
    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 3
});

module.exports = worker;
