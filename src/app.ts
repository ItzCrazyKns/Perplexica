import { startWebSocketServer } from './websocket';
import express from 'express';
import cors from 'cors';
import http from 'http';
import routes from './routes';
import authRouter from './routes/auth';
import { getPort } from './config';
import logger from './utils/logger';
import { authMiddleware } from './middleware/auth';

const port = getPort();

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: '*',
};

app.use(cors(corsOptions));
app.use(express.json());

// 公开路由 - 无需认证
app.get('/api', (_, res) => {
  res.status(200).json({ status: 'ok' });
});

// 认证路由 - 无需认证
app.use('/api/auth', authRouter);

// 受保护的路由 - 需要认证
// 注意：这里必须在'/api/auth'之后定义，避免认证中间件拦截认证请求
app.use('/api', authMiddleware, routes);

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
