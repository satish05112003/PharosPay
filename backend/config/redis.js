const Redis = require('ioredis');
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null // Required by BullMQ
});

redis.on('error', (err) => {
  console.error('Redis Client Error:', err.message);
});

module.exports = redis;
