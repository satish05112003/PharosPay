const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const supportQueue = new Queue('support-general', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 5000
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 }
  }
});

module.exports = {
  supportQueue,
  aiQueue: require('./aiQueue'),
  escalationQueue: require('./escalationQueue'),
  emailQueue: require('./emailQueue')
};
