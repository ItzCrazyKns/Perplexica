import { startWebSocketServer } from './websocket';
import express from 'express';
import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import routes from './routes';
import { getPort } from './config';
import logger from './utils/logger';
import redisClient from './utils/redisClient';
const port = getPort();

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: '*',
};

app.use(cors(corsOptions));
app.use(express.json());

app.use(async (req: Request, res: Response, next: NextFunction) => {
  const cache = req.query.cache as string;

  if (cache === '1') {
    const cacheKey = req.originalUrl || req.url;

    try {
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        logger.info(`Cache hit for ${cacheKey}`);
        const jsonData = JSON.parse(cachedData);
        return res.json(JSON.parse(jsonData));
      } else {
        const originalSend = res.send.bind(res);

        res.send = (body: any) => {
          const result = originalSend(body);

          redisClient
            .setEx(cacheKey, 86400, JSON.stringify(body))
            .then(() => logger.info(`Cache set for ${cacheKey}`))
            .catch((err) => logger.error(`Redis setEx error: ${err}`));

          return result;
        };

        next();
      }
    } catch (error) {
      logger.error(`Unexpected error: ${error}`);
      next();
    }
  } else {
    next();
  }
});
app.use('/api', routes);
app.get('/api', (_, res) => {
  res.status(200).json({ status: 'ok' });
});

server.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});

startWebSocketServer(server);

process.on('uncaughtException', (err, origin) => {
  logger.error(`Uncaught Exception at ${origin}: ${err}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});
