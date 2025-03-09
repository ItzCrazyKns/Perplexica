import { WebSocketServer } from 'ws';
import { handleConnection } from './connectionManager';
import http from 'http';
import { getPort, getAuthSecret } from '../config';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';
import { URL } from 'url';

export const initServer = (
  server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>,
) => {
  const port = getPort();
  const wss = new WebSocketServer({ noServer: true });

  // 拦截升级请求
  server.on('upgrade', (request, socket, head) => {
    try {
      // 从请求URL中获取令牌
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('WebSocket连接尝试未提供令牌');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // 验证令牌
      const secret = getAuthSecret();
      try {
        jwt.verify(token, secret);
        
        // 令牌有效，允许升级连接
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch (err) {
        logger.warn(`无效的WebSocket认证令牌: ${err.message}`);
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
      }
    } catch (err) {
      logger.error(`WebSocket认证错误: ${err}`);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', handleConnection);

  logger.info(`WebSocket server started on port ${port}`);
};
