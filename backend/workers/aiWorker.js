const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const db = require('../database/db');
const AISupportService = require('../services/AISupportService');
const SeverityEngine = require('../services/SeverityEngine');
const TicketManager = require('../services/TicketManager');

const ticketManager = new TicketManager(db);
const aiSupportService = new AISupportService(db);
const severityEngine = new SeverityEngine(db, ticketManager);

// Global Socket.IO reference
let ioInstance = null;
function setSocketIO(io) {
  ioInstance = io;
}

const worker = new Worker('support-ai', async (job) => {
  const { sessionId, wallet, message, contextText } = job.data;
  console.log(`[aiWorker] Processing AI chat job: ${job.id} for session: ${sessionId}`);

  try {
    let userMessageId = job.data.userMessageId;

    if (!userMessageId) {
      // Upsert support_chat_sessions
      await db.query(
        `INSERT INTO support_chat_sessions (session_id, wallet_address, status, created_at, updated_at)
         VALUES ($1, $2, 'ACTIVE', NOW(), NOW())
         ON CONFLICT (session_id) DO NOTHING`,
        [sessionId, wallet]
      );
      // Insert user message into support_chat_messages
      const userChatMsgRes = await db.query(
        `INSERT INTO support_chat_messages (session_id, role, message, timestamp)
         VALUES ($1, 'user', $2, NOW())
         RETURNING id`,
        [sessionId, message]
      );
      userMessageId = userChatMsgRes.rows[0]?.id;

      // Legacy tables insertion
      await db.query(
        `INSERT INTO support_sessions (session_id, wallet_address, status, started_at, last_message_at)
         VALUES ($1, $2, 'ACTIVE', NOW(), NOW())
         ON CONFLICT (session_id) DO NOTHING`,
        [sessionId, wallet]
      );
      await db.query(
        `INSERT INTO support_messages (id, session_id, wallet_address, sender_type, sender_name, content, created_at)
         VALUES ($1, $2, $3, 'user', $3, $4, NOW())`,
        [userMessageId, sessionId, wallet, message]
      );
    }

    // 2. Fetch AI completion from AISupportService
    const aiResponse = await aiSupportService.getCompletion(sessionId, wallet, message, contextText);

    // 3. Classify message severity and intent
    const rawContext = await aiSupportService.buildUserContext(wallet);
    const classification = await severityEngine.classify(message, rawContext);

    // 4. Save AI message to support_chat_messages (new table)
    const aiChatMsgRes = await db.query(
      `INSERT INTO support_chat_messages (session_id, role, message, timestamp)
       VALUES ($1, 'assistant', $2, NOW())
       RETURNING id`,
      [sessionId, aiResponse.answer]
    );
    const aiMessageId = aiChatMsgRes.rows[0]?.id;

    // Legacy AI message write
    await db.query(
      `INSERT INTO support_messages (id, session_id, wallet_address, sender_type, sender_name, content, created_at)
       VALUES ($1, $2, $3, 'ai', 'Pharos', $4, NOW())`,
      [aiMessageId, sessionId, wallet, aiResponse.answer]
    );

    // 5. Save classification results into ai_analyses table
    await db.query(
      `INSERT INTO ai_analyses (
        message_id, severity, category, confidence, needs_escalation, 
        escalation_reason, root_cause, suggested_actions, estimated_resolution, 
        model_used, processing_ms
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        userMessageId,
        classification.severity,
        classification.category,
        classification.confidence,
        classification.needsEscalation,
        classification.escalationReason,
        classification.rootCause,
        classification.suggestedActions,
        classification.estimatedResolutionTime,
        aiResponse.modelUsed || 'google/gemini-2.5-flash',
        aiResponse.processingMs || 0
      ]
    );

    // Increment message count on session
    await db.query(
      `UPDATE support_sessions 
       SET message_count = message_count + 2, last_message_at = NOW()
       WHERE session_id = $1`,
      [sessionId]
    );

    await db.query(
      `UPDATE support_chat_sessions
       SET updated_at = NOW()
       WHERE session_id = $1`,
      [sessionId]
    );

    let ticketId = null;

    // 6. Handle auto-ticket creation for CRITICAL issues with high confidence
    if (classification.severity === 'CRITICAL' && classification.confidence > 0.80) {
      console.log(`[aiWorker] Critical message detected. Initiating auto-ticket creation...`);
      const autoTicket = await severityEngine.handleAutoTicket(wallet, classification, message);
      if (autoTicket) {
        ticketId = autoTicket.id;
        
        // Link ticket to current session
        await db.query(
          `UPDATE support_sessions SET ticket_id = $1, status = 'HANDOFF' WHERE session_id = $2`,
          [ticketId, sessionId]
        );
        await db.query(
          `UPDATE support_chat_sessions SET ticket_id = $1, status = 'HANDOFF', updated_at = NOW() WHERE session_id = $2`,
          [ticketId, sessionId]
        );
      }
    }

    const payload = {
      messageId: aiMessageId,
      sessionId,
      answer: aiResponse.answer,
      severity: classification.severity,
      category: classification.category,
      confidence: classification.confidence,
      needsEscalation: classification.needsEscalation,
      escalationReason: classification.escalationReason,
      suggestedActions: classification.suggestedActions,
      relatedPayments: rawContext.recentPayments.slice(0, 2),
      modelUsed: aiResponse.modelUsed,
      processingMs: aiResponse.processingMs,
      ticketId
    };

    // 7. Emit through Socket.IO to user and session rooms
    if (ioInstance) {
      ioInstance.to(`wallet:${wallet}`).emit('support:response', payload);
      ioInstance.to(`session:${sessionId}`).emit('support:response', payload);
    }

    return payload;

  } catch (err) {
    console.error(`[aiWorker] Processing job ${job.id} failed:`, err.message);
    
    // Fallback response delivery
    const fallback = aiSupportService.keywordFallback(message);
    
    if (ioInstance) {
      ioInstance.to(`wallet:${wallet}`).emit('support:error', {
        sessionId,
        answer: fallback.answer,
        severity: fallback.severity,
        category: fallback.category,
        error: err.message
      });
    }

    throw err;
  }
}, {
  connection: redisConnection,
  concurrency: 10
});

module.exports = {
  worker,
  setSocketIO
};
