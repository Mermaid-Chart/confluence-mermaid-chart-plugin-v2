import { Redis } from '@upstash/redis';

export function createRedisStore() {
  const client = new Redis({
    url: process.env.DB_URL || process.env.KV_REST_API_URL,
    token: process.env.DB_TOKEN || process.env.KV_REST_API_TOKEN,
  });

  const redisKey = (key, clientKey) => (clientKey ? `${clientKey}:${key}` : key);

  return {
    get: (key, clientKey) => client.get(redisKey(key, clientKey)),
    set: (key, val, clientKey) => client.set(redisKey(key, clientKey), val),
    del: (key, clientKey) => client.del(redisKey(key, clientKey)),
  };
}
