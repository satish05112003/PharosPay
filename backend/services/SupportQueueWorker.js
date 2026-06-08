const aiWorkerHub = require('../workers/aiWorker');
const escalationWorker = require('../workers/escalationWorker');
const emailWorker = require('../workers/emailWorker');

class SupportQueueWorker {
  /**
   * Initializes and starts all background queue worker listening streams
   */
  static start() {
    console.log('⬡ PharosPay Queue System: Initializing workers...');
    
    // Listen for worker lifecycle error events
    aiWorkerHub.worker.on('error', (err) => {
      console.error('[BullMQ Worker support-ai] Error:', err.message);
    });
    escalationWorker.on('error', (err) => {
      console.error('[BullMQ Worker support-escalation] Error:', err.message);
    });
    emailWorker.on('error', (err) => {
      console.error('[BullMQ Worker support-email] Error:', err.message);
    });

    console.log('  ✔ support-ai worker active');
    console.log('  ✔ support-escalation worker active');
    console.log('  ✔ support-email worker active');
  }

  static setSocketIO(io) {
    aiWorkerHub.setSocketIO(io);
  }

  /**
   * Safe closure hooks
   */
  static async shutdown() {
    console.log('[QueueWorker] Shutting down workers...');
    await Promise.all([
      aiWorkerHub.worker.close(),
      escalationWorker.close(),
      emailWorker.close()
    ]);
    console.log('[QueueWorker] All workers terminated.');
  }
}

module.exports = SupportQueueWorker;
