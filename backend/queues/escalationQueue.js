const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const escalationQueue = new Queue('support-escalation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: false, // Never auto-remove (required for audits)
    removeOnFail: false
  }
});

module.exports = escalationQueue;
