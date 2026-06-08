const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const db = require('../database/db');
const EscalationEngine = require('../services/EscalationEngine');
const TicketManager = require('../services/TicketManager');
const emailQueue = require('../queues/emailQueue');

const ticketManager = new TicketManager(db);
const escalationEngine = new EscalationEngine(db, ticketManager);

const worker = new Worker('support-escalation', async (job) => {
  const { name, data } = job;
  console.log(`[escalationWorker] Processing escalation job: ${job.id} - Name: ${name}`);

  try {
    switch (name) {
      case 'create_ticket': {
        const result = await escalationEngine.createEscalation(data);
        return result;
      }
      
      case 'auto_escalate': {
        // AI auto-created critical tickets pipeline
        const { ticketId, wallet, severity, confidence, sessionId } = data;
        
        // Enqueue email notifications
        const ADMIN_EMAIL = process.env.ADMIN_SUPPORT_EMAIL || 'support@pharospay.xyz';
        
        await emailQueue.add('escalation_admin', {
          adminEmail: ADMIN_EMAIL,
          ticket: {
            ticketNumber: data.ticketNumber || 'TKT-AUTO',
            userWallet: wallet,
            priority: 'urgent',
            category: data.category || 'security_concern',
            description: data.description || 'AI Auto-escalated Critical security alert.'
          },
          contactInfo: {
            email: 'security-alert@pharospay.xyz',
            telegram: null,
            discord: null
          },
          aiAnalysis: {
            confidence,
            rootCause: 'AI automated threat detection model match',
            estimatedResolution: '1 hour'
          }
        });

        console.log(`[escalationWorker] Auto-escalated alert successfully sent for ticket: ${ticketId}`);
        return { success: true };
      }

      case 'notify_admin': {
        const ADMIN_EMAIL = process.env.ADMIN_SUPPORT_EMAIL || 'support@pharospay.xyz';
        await emailQueue.add('escalation_admin', {
          adminEmail: ADMIN_EMAIL,
          ticket: data.ticket,
          contactInfo: data.contactInfo,
          aiAnalysis: data.aiAnalysis
        });
        return { success: true };
      }

      case 'notify_user': {
        await emailQueue.add('ticket_confirm', {
          email: data.email,
          ticket: data.ticket
        });
        return { success: true };
      }

      default:
        console.warn(`[escalationWorker] Unknown job name: ${name}`);
        return { error: 'Unknown job name' };
    }
  } catch (err) {
    console.error(`[escalationWorker] Job ${job.id} failed:`, err.message);
    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 5
});

module.exports = worker;
