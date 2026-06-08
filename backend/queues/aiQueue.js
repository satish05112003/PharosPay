const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const aiQueue = new Queue('support-ai', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 3000
    },
    removeOnComplete: {
      count: 1000,
      age: 86400 // 24 hours
    },
    removeOnFail: {
      count: 500,
      age: 604800 // 7 days
    }
  }
});

module.exports = aiQueue;
