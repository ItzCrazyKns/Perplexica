import { startWebSocketServer } from './websocket';
import express from 'express';
import cors from 'cors';
import http from 'http';
import routes from './routes';
import { getPort } from './config';
import logger from './utils/logger';

const port = getPort();

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: '*',
};

logger.info(`🚀 Initializing Server Setup...`);
logger.info(`🛠 CORS Policy Applied: ${JSON.stringify(corsOptions)}`);

app.use(cors(corsOptions));
app.use(express.json());

// ✅ Middleware to log incoming requests
app.use((req, res, next) => {
  logger.info(`📩 API Request - ${req.method} ${req.originalUrl}`);
  next();
});

logger.info(`✅ API Routes Initialized`);

app.use('/api', routes);
app.get('/api', (_, res) => {
  logger.info(`🟢 Health Check Endpoint Hit`);
  res.status(200).json({ status: 'ok' });
});

// ✅ Log when the server starts listening
server.listen(port, () => {
  logger.info(`✅ Server is running on port ${port}`);
});

// ✅ Log WebSocket Initialization
logger.info(`📡 Starting WebSocket Server...`);
startWebSocketServer(server);

// ✅ Better Logging for Uncaught Errors
process.on('uncaughtException', (err, origin) => {
  logger.error(`🔥 Uncaught Exception at ${origin}: ${err.message}`);
  logger.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`🚨 Unhandled Rejection at: ${promise}`);
  logger.error(`💥 Reason: ${reason}`);
});
