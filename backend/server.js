require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import DB & services
const db = require('./database/db');
const providerFactory = require('./config/providers');
const SettlementEngine = require('./services/settlementEngine');
const EventListener = require('./services/eventListener');
const WebhookProcessor = require('./services/webhookProcessor');
const ReceiptGenerator = require('./services/receiptGenerator');

// Instantiate Services
const settlementEngine = new SettlementEngine(db, providerFactory, null);
const eventListener = new EventListener(db, settlementEngine);
const webhookProcessor = new WebhookProcessor(db, settlementEngine);
const receiptGenerator = new ReceiptGenerator(db);

// Import Route Builders
const qrRoutes = require('./routes/qr');
const quoteRoutes = require('./routes/quote');
const settleRoutes = require('./routes/settle')(settlementEngine, db);
const merchantsRoutes = require('./routes/merchants');
const paymentsRoutes = require('./routes/payments')(db);
const receiptsRoutes = require('./routes/receipts')(receiptGenerator);
const webhooksRoutes = require('./routes/webhooks')(webhookProcessor);

const app = express();

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

// ─── Health Check ────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'pharospay-api',
    version: '1.0.0',
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

    // 3. Start Express server
    app.listen(PORT, () => {
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

bootstrap();
