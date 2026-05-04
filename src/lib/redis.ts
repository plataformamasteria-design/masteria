import { getRedisConnection } from './redis-connection';

// Singleton for general use (non-BullMQ)
const redis = getRedisConnection();

export default redis;
export { redis };