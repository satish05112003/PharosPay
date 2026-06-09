require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Import DB & services
const db = require('./database/db');
const providerFactory = require('./config/providers');
const SettlementEngine = require('./services/settlementEngine');
const EventListener = require('./services/eventListener');
const WebhookProcessor = require('./services/webhookProcessor');
const ReceiptGenerator = require('./services/receiptGenerator');
const TicketManager = require('./services/TicketManager');
const SupportQueueWorker = require('./services/SupportQueueWorker');
const AIProvider = require('./services/AIProvider');

// Instantiate Services
const settlementEngine = new SettlementEngine(db, providerFactory, null);
const eventListener = new EventListener(db, settlementEngine);
const webhookProcessor = new WebhookProcessor(db, settlementEngine);
const receiptGenerator = new ReceiptGenerator(db);
const ticketManager = new TicketManager(db);

// Import Route Builders
const qrRoutes = require('./routes/qr');
const quoteRoutes = require('./routes/quote');
const settleRoutes = require('./routes/settle')(settlementEngine, db);
const merchantsRoutes = require('./routes/merchants');
const paymentsRoutes = require('./routes/payments')(db);
const receiptsRoutes = require('./routes/receipts')(receiptGenerator);
const webhooksRoutes = require('./routes/webhooks')(webhookProcessor);
const supportRoutes = require('./routes/support')(ticketManager, db);

// Phase 2 Route Builders
const supportChatRoutes = require('./routes/supportChat')(db);
const escalationRoutes = require('./routes/escalation')(db);
const receiptVerifyRoutes = require('./routes/receiptVerify')(db);
const adminV2Routes = require('./routes/adminV2')(db);

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Configure Socket.IO connections
io.on('connection', (socket) => {
  console.log(`[Socket.IO] New client connection: ${socket.id}`);

  socket.on('join_session', (sessionId) => {
    socket.join(`session:${sessionId}`);
    console.log(`[Socket.IO] Client joined session room: session:${sessionId}`);
  });

  socket.on('join_wallet', (walletAddress) => {
    socket.join(`wallet:${walletAddress.toLowerCase()}`);
    console.log(`[Socket.IO] Client joined wallet room: wallet:${walletAddress}`);
  });

  socket.on('join_admin', () => {
    socket.join('admin_room');
    console.log('[Socket.IO] Admin joined admin_room');
  });

  socket.on('admin:message', async (data) => {
    // When admin types in socket-driven chat
    const { ticketId, message, senderId } = data;
    try {
      const reply = await ticketManager.addReply(ticketId, message, 'agent', senderId || 'Admin');
      // Broadcast to users in session room
      const ticket = await db.supportTickets.findById(ticketId);
      if (ticket) {
        // Find session linked to ticket
        const sessionRes = await db.query('SELECT session_id FROM support_sessions WHERE ticket_id = $1', [ticketId]);
        const sessionIds = sessionRes.rows.map(r => r.session_id);
        
        sessionIds.forEach(sid => {
          io.to(`session:${sid}`).emit('support:message', {
            id: reply.id,
            senderType: 'agent',
            senderName: reply.sender_name,
            message: reply.message,
            createdAt: reply.created_at
          });
        });
      }
    } catch (err) {
      console.error('[Socket.IO] Admin reply failed:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Pass Socket.IO down to Queue Worker and admin routes
SupportQueueWorker.setSocketIO(io);
adminV2Routes.setSocketIO(io);

// ─── Middleware ───────────────────────────────────────────────────────────
app.use(cors());

// Webhooks route handles its own raw body parser to support signature checks
app.use('/webhooks', webhooksRoutes);

app.use(express.json({ limit: '10mb' }));

// ─── Routes ──────────────────────────────────────────────────────────────
app.use('/api', qrRoutes);
app.use('/api', quoteRoutes);
app.use('/api', settleRoutes);
app.use('/api', merchantsRoutes);
app.use('/api', paymentsRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/support', supportRoutes);

// Register Phase 2 Routes
app.use('/api/support', supportChatRoutes);
app.use('/api/support', escalationRoutes);
app.use('/api/receipts', receiptVerifyRoutes);
app.use('/api/admin/support', adminV2Routes);

// ─── Health Check ────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'pharospay-api',
    version: '2.0.0 (AI support)',
    timestamp: new Date().toISOString(),
  });
});

// ─── Startup Logic ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    // 1. Run migrations
    await db.runMigrations();

    // 2. Start smart contract event listener
    await eventListener.start();

    // 3. Start BullMQ Background Workers
    SupportQueueWorker.start();

    // 4. Start HTTP Server
    server.listen(PORT, () => {
      console.log(`\n⬡ PharosPay API running on http://localhost:${PORT}`);
      console.log(`  Health: http://localhost:${PORT}/api/health`);
      console.log(`  QR Parse: POST http://localhost:${PORT}/api/parse-qr`);
      console.log(`  Quote: GET http://localhost:${PORT}/api/quote?amount=100&currency=INR`);
      console.log(`  Settle: POST http://localhost:${PORT}/api/settle\n`);
    });
  } catch (err) {
    console.error('Fatal bootstrapping error:', err);
    process.exit(1);
  }
}

bootstrap(); // Trigger reload 4

