import { WebSocketServer } from "ws";
import { handleConnection } from "./connectionManager";
import http from "node:http";
import { getPort } from "../config";
import logger from "../utils/logger";

export const initServer = (server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>) => {
  const port = getPort();
  const wss = new WebSocketServer({ server });

  wss.on("connection", handleConnection);

  logger.info(`WebSocket server started on port ${port}`);
};
