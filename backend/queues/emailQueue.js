const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const emailQueue = new Queue('support-email', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000
    },
    removeOnComplete: {
      count: 500
    },
    removeOnFail: {
      count: 100
    }
  }
});

module.exports = emailQueue;
