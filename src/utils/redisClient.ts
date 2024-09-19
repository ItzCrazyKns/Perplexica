import { createClient } from 'redis';
import { getRedisHost, getRedisPort } from '../config';
import logger from './logger';

const redisUrl = `redis://${getRedisHost()}:${getRedisPort()}`;
const client = createClient({ url: redisUrl });

client.on('error', (err) => {
  logger.error(`Redis Client Error: ${err}`);
});
client
  .connect()
  .then(() => logger.info('Connected to Redis'))
  .catch((err) => logger.error(`Redis connection error: ${err}`));
export default client;
